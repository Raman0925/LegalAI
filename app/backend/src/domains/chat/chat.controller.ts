import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { sendMessage, streamMessageIterable } from './chat.service.js';
import { chatRequestSchema, chatResponseSchema, errorResponseSchema } from './chat.validator.js';

interface ChatRequestBody {
  message: string;
  history?: { role: 'user' | 'assistant' | 'system'; content: string }[];
  tier?: 'fast' | 'balanced' | 'powerful';
}

const chatController = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
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
    },
    async (request: FastifyRequest<{ Body: ChatRequestBody }>, reply: FastifyReply) => {
      const { message, history = [], tier = 'balanced' } = request.body;
      const result = await sendMessage(message, history, tier);
      return reply.code(200).send(result);
    }
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
    },
    async (request: FastifyRequest<{ Body: ChatRequestBody }>, reply: FastifyReply) => {
      const { message, history = [], tier = 'balanced' } = request.body;

      if (!reply.sse) {
        return reply.code(406).send({
          error: 'Not Acceptable',
          message: 'Accept header must contain text/event-stream',
          statusCode: 406
        });
      }

      const sseStream = streamMessageIterable(message, history, tier);
      return reply.sse.send(sseStream);
    }
  );
};

export default chatController;
