import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
import { planLimit } from '#middlewares/plan-limits.middleware.js';
import { trackAfterResponse } from '#middlewares/usage-tracker.middleware.js';
import * as repo from './research.repository.js';
import { streamResearch } from './research.service.js';
import {
  CreateSessionSchema,
  SendMessageSchema,
  SessionIdParamSchema,
  createSessionJsonSchema,
  sendMessageJsonSchema,
} from './research.schema.js';

export async function researchController(app: FastifyInstance) {

  // POST /api/research/sessions — create new research session
  app.post('/research/sessions', {
    preHandler: [authenticate],
    schema: createSessionJsonSchema,
  }, async (request, reply) => {
    const { firmId, id: userId } = request.user;
    const body = CreateSessionSchema.parse(request.body);

    const session = await repo.createSession(app.supabase, {
      firmId,
      userId,
      matterId: body.matterId,
      title: body.title,
      query: body.query,
    });

    return reply.status(201).send({ session });
  });

  // GET /api/research/sessions — list all sessions for firm
  app.get('/research/sessions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { firmId } = request.user;
    const sessions = await repo.getSessionsByFirm(app.supabase, firmId);
    return reply.send({ sessions });
  });

  // GET /api/research/sessions/:sessionId — get session + messages
  app.get('/research/sessions/:sessionId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: { sessionId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { sessionId } = SessionIdParamSchema.parse(request.params);

    const session = await repo.getSessionById(app.supabase, sessionId, firmId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const messages = await repo.getMessagesBySession(app.supabase, sessionId, firmId);
    return reply.send({ session, messages });
  });

  // POST /api/research/sessions/:sessionId/stream — SSE research stream
  // planLimit enforced BEFORE stream starts — 429 if daily AI calls exceeded
  // trackAfterResponse increments ai_calls AFTER successful stream
  app.post('/research/sessions/:sessionId/stream', {
    preHandler: [authenticate, planLimit('ai_calls')],
    onResponse: [trackAfterResponse('ai_calls')],
    schema: sendMessageJsonSchema,
  }, async (request, reply) => {
    const { firmId, id: userId } = request.user;
    const { sessionId } = SessionIdParamSchema.parse(request.params);
    const body = SendMessageSchema.parse(request.body);

    const session = await repo.getSessionById(app.supabase, sessionId, firmId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const messages = await repo.getMessagesBySession(app.supabase, sessionId, firmId);
    const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      const stream = streamResearch(app.supabase, {
        sessionId,
        firmId,
        userId,
        matterId: session.matterId ?? undefined,
        userQuery: body.content,
        conversationHistory,
        searchWeb: body.searchWeb,
      });

      for await (const chunk of stream) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err) {
      request.log.error(err, 'Research stream failed');
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });
}
