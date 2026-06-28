import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
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

  // POST /research/sessions — create new session
  app.post('/research/sessions', {
    preHandler: [authenticate],
    schema: createSessionJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const body = CreateSessionSchema.parse(request.body);

    const session = await repo.createSession(app.supabase, {
      firmId: user.firmId || '00000000-0000-0000-0000-000000000000',
      userId: user.id,
      matterId: body.matterId,
      title: body.title,
      query: body.query,
    });

    return reply.status(201).send({ session });
  });

  // GET /research/sessions — list all sessions for firm
  app.get('/research/sessions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const sessions = await repo.getSessionsByFirm(
      app.supabase,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    return reply.send({ sessions });
  });

  // GET /research/sessions/:sessionId — get session with messages
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
    const user = request.user!;
    const { sessionId } = SessionIdParamSchema.parse(request.params);

    const session = await repo.getSessionById(
      app.supabase,
      sessionId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const messages = await repo.getMessagesBySession(
      app.supabase,
      sessionId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    return reply.send({ session, messages });
  });

  // POST /research/sessions/:sessionId/stream — SSE research stream
  app.post('/research/sessions/:sessionId/stream', {
    preHandler: [authenticate],
    schema: sendMessageJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const { sessionId } = SessionIdParamSchema.parse(request.params);
    const body = SendMessageSchema.parse(request.body);

    // Verify session ownership
    const session = await repo.getSessionById(
      app.supabase,
      sessionId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    // Fetch history for context
    const messages = await repo.getMessagesBySession(
      app.supabase,
      sessionId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      const stream = streamResearch(app.supabase, {
        sessionId,
        firmId: user.firmId || '00000000-0000-0000-0000-000000000000',
        userId: user.id,
        matterId: session.matterId ?? undefined,
        userQuery: body.content,
        conversationHistory,
        searchWeb: body.searchWeb,
      });

      for await (const chunk of stream) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });
}
