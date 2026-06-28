import { z } from 'zod';

export const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(300).default('Untitled Document'),
  matterId: z.string().uuid().optional(),
  templateContent: z.record(z.string(), z.unknown()).optional(), // pre-filled TipTap JSON
});

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.record(z.string(), z.unknown()),   // TipTap JSONContent
  wordCount: z.number().int().min(0),
  status: z.enum(['draft', 'review', 'final', 'archived']).optional(),
});

export const SaveVersionSchema = z.object({
  content: z.record(z.string(), z.unknown()),
  wordCount: z.number().int().min(0),
  label: z.string().max(200).optional(),
});

export const AiSuggestSchema = z.object({
  precedingText: z.string().max(3000),  // text before cursor
  documentTitle: z.string().max(300),
});

export const AiRewriteSchema = z.object({
  selectedText: z.string().min(1).max(5000),
  tone: z.enum(['formal', 'simplified', 'aggressive', 'conciliatory', 'neutral']),
  documentTitle: z.string().max(300),
});

export const ExportSchema = z.object({
  format: z.enum(['pdf', 'docx']),
  title: z.string().max(300).optional(),
});

export const DocumentIdParamSchema = z.object({
  documentId: z.string().uuid(),
});

// Fastify JSON schemas
export const updateDocumentJsonSchema = {
  body: {
    type: 'object',
    required: ['content', 'wordCount'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 300 },
      content: { type: 'object' },
      wordCount: { type: 'integer', minimum: 0 },
      status: { type: 'string', enum: ['draft', 'review', 'final', 'archived'] },
    },
  },
  params: {
    type: 'object',
    required: ['documentId'],
    properties: { documentId: { type: 'string', format: 'uuid' } },
  },
};

export const aiSuggestJsonSchema = {
  body: {
    type: 'object',
    required: ['precedingText', 'documentTitle'],
    properties: {
      precedingText: { type: 'string', maxLength: 3000 },
      documentTitle: { type: 'string', maxLength: 300 },
    },
  },
  params: {
    type: 'object',
    required: ['documentId'],
    properties: { documentId: { type: 'string', format: 'uuid' } },
  },
};

// Response Models
export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
};

export const legalDocumentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    firmId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    matterId: { type: ['string', 'null'], format: 'uuid' },
    title: { type: 'string' },
    content: { type: 'object' },
    wordCount: { type: 'integer' },
    status: { type: 'string', enum: ['draft', 'review', 'final', 'archived'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'firmId', 'userId', 'title', 'content', 'wordCount', 'status', 'createdAt', 'updatedAt'],
};

export const documentVersionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    documentId: { type: 'string', format: 'uuid' },
    firmId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    content: { type: 'object' },
    wordCount: { type: 'integer' },
    label: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'documentId', 'firmId', 'userId', 'content', 'wordCount', 'createdAt'],
};

