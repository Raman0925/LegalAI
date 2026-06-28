import { z } from 'zod';

export const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
  query: z.string().min(3).max(2000),
  matterId: z.string().uuid().optional(),
  searchWeb: z.boolean().default(false),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  searchWeb: z.boolean().default(false),
});

export const SessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});

// Fastify JSON schema for route validation
export const createSessionJsonSchema = {
  body: {
    type: 'object',
    required: ['title', 'query'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 200 },
      query: { type: 'string', minLength: 3, maxLength: 2000 },
      matterId: { type: 'string', format: 'uuid' },
      searchWeb: { type: 'boolean', default: false },
    },
  },
};

export const sendMessageJsonSchema = {
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 5000 },
      searchWeb: { type: 'boolean', default: false },
    },
  },
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', format: 'uuid' },
    },
  },
};
