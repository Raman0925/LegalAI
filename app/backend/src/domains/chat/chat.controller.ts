import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { sendMessage, streamMessageIterable } from './chat.service.js';
import { chatRequestSchema, chatResponseSchema, errorResponseSchema } from './chat.validator.js';
import authenticate from '#middlewares/auth.middleware.js';
import { planLimit } from '#middlewares/plan-limits.middleware.js';
import { trackAfterResponse } from '#middlewares/usage-tracker.middleware.js';
import * as repo from './chat.repository.js';

interface ChatRequestBody {
  message: string;
  history?: { role: 'user' | 'assistant' | 'system'; content: string }[];
  tier?: 'fast' | 'balanced' | 'powerful';
}

const chatController = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
  // GET /chat/history
  fastify.get(
    '/history',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Chat'],
        summary: 'Get chat history',
        description: 'Loads historical chat messages for the current user session.',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId, firmId } = request.user;
      const sessionId = await repo.getOrCreateActiveSession(fastify.supabase, firmId, userId);
      const messages = await repo.getMessages(fastify.supabase, sessionId, firmId);
      return reply.code(200).send({ messages });
    }
  );

  // POST /chat
  fastify.post(
    '/',
    {
      schema: {
        tags: ['Chat'],
        summary: 'Send chat message',
        description: 'Sends a chat message and retrieves a complete response.',
        body: chatRequestSchema,
        response: {
          200: chatResponseSchema,
          '4xx': errorResponseSchema,
          '5xx': errorResponseSchema,
        },
      },
      preHandler: [authenticate, planLimit('ai_calls')],
      onResponse: [trackAfterResponse('ai_calls')],
    } as Record<string, unknown>,
    async (request: FastifyRequest<{ Body: ChatRequestBody }>, reply: FastifyReply) => {
      const { message, tier = 'balanced' } = request.body;
      const { id: userId, firmId } = request.user;
      const result = await sendMessage(fastify.supabase, message, tier, userId, firmId);
      return reply.code(200).send(result);
    },
  );

  // POST /chat/stream
  fastify.post(
    '/stream',
    {
      sse: true,
      schema: {
        tags: ['Chat'],
        summary: 'Stream chat message',
        description: 'Streams response using Server-Sent Events (SSE).',
        body: chatRequestSchema,
        response: {
          '4xx': errorResponseSchema,
          '5xx': errorResponseSchema,
        },
      },
      preHandler: [authenticate, planLimit('ai_calls')],
      onResponse: [trackAfterResponse('ai_calls')],
    } as Record<string, unknown>,
    async (request: FastifyRequest<{ Body: ChatRequestBody }>, reply: FastifyReply) => {
      const { message, tier = 'balanced' } = request.body;
      const { id: userId, firmId } = request.user;

      if (!reply.sse) {
        return reply.code(406).send({
          error: 'Not Acceptable',
          message: 'Accept header must contain text/event-stream',
          statusCode: 406,
        });
      }

      const sseStream = streamMessageIterable(fastify.supabase, message, tier, userId, firmId);
      return reply.sse.send(sseStream);
    },
  );
};

export default chatController;
