import { z } from 'zod';

export const ContractIdParamSchema = z.object({
  contractId: z.string().uuid(),
});

export const UploadContractSchema = z.object({
  matterId: z.string().uuid().optional(),
});

export const ClauseQuestionSchema = z.object({
  question: z.string().min(3).max(2000),
  annotationId: z.string().uuid().optional(),  // context: which clause
  pageNumber: z.number().int().positive().optional(),
});

// Fastify JSON schemas
export const contractIdParamJsonSchema = {
  params: {
    type: 'object',
    required: ['contractId'],
    properties: {
      contractId: { type: 'string', format: 'uuid' },
    },
  },
};

export const clauseQuestionJsonSchema = {
  body: {
    type: 'object',
    required: ['question'],
    properties: {
      question: { type: 'string', minLength: 3, maxLength: 2000 },
      annotationId: { type: 'string', format: 'uuid' },
      pageNumber: { type: 'integer', minimum: 1 },
    },
  },
  params: {
    type: 'object',
    required: ['contractId'],
    properties: {
      contractId: { type: 'string', format: 'uuid' },
    },
  },
};
