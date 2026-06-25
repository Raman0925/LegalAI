import { documentResponseSchema } from '../document/document.validator.js';

export const createMatterBodySchema = {
  type: 'object',
  required: ['title', 'matterType'],
  properties: {
    title: { type: 'string', minLength: 1 },
    clientName: { type: 'string', nullable: true },
    matterType: {
      type: 'string',
      enum: ['general', 'contract', 'litigation', 'advisory', 'compliance'],
    },
    status: { type: 'string', enum: ['open', 'in_progress', 'closed', 'archived'] },
    description: { type: 'string', nullable: true },
  },
};

export const updateMatterBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1 },
    clientName: { type: 'string', nullable: true },
    matterType: {
      type: 'string',
      enum: ['general', 'contract', 'litigation', 'advisory', 'compliance'],
    },
    status: { type: 'string', enum: ['open', 'in_progress', 'closed', 'archived'] },
    description: { type: 'string', nullable: true },
  },
};

export const attachDocumentBodySchema = {
  type: 'object',
  required: ['documentId'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
  },
};

export const createDraftBodySchema = {
  type: 'object',
  required: ['title', 'draftType', 'instructions'],
  properties: {
    title: { type: 'string', minLength: 1 },
    draftType: { type: 'string', enum: ['contract', 'letter', 'memo', 'clause'] },
    instructions: { type: 'string', minLength: 1 },
  },
};

export const matterResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    clientName: { type: 'string', nullable: true },
    matterType: {
      type: 'string',
      enum: ['general', 'contract', 'litigation', 'advisory', 'compliance'],
    },
    status: { type: 'string', enum: ['open', 'in_progress', 'closed', 'archived'] },
    description: { type: 'string', nullable: true },
    documentCount: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'userId', 'title', 'matterType', 'status', 'createdAt', 'updatedAt'],
};

export const matterListResponseSchema = {
  type: 'array',
  items: matterResponseSchema,
};

export const matterClauseResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    matterId: { type: 'string', format: 'uuid' },
    documentId: { type: 'string', format: 'uuid' },
    clauseType: { type: 'string' },
    content: { type: 'string' },
    riskLevel: { type: 'string', enum: ['high', 'medium', 'low'], nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'matterId', 'documentId', 'clauseType', 'content', 'createdAt'],
};

export const matterClauseListResponseSchema = {
  type: 'array',
  items: matterClauseResponseSchema,
};

export const matterDraftResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    matterId: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    content: { type: 'string' },
    draftType: { type: 'string', enum: ['contract', 'letter', 'memo', 'clause'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'matterId', 'title', 'content', 'draftType', 'createdAt', 'updatedAt'],
};

export const matterDraftListResponseSchema = {
  type: 'array',
  items: matterDraftResponseSchema,
};

export const matterWithDetailsResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    clientName: { type: 'string', nullable: true },
    matterType: {
      type: 'string',
      enum: ['general', 'contract', 'litigation', 'advisory', 'compliance'],
    },
    status: { type: 'string', enum: ['open', 'in_progress', 'closed', 'archived'] },
    description: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    attachedDocuments: {
      type: 'array',
      items: documentResponseSchema,
    },
    clauses: matterClauseListResponseSchema,
    drafts: matterDraftListResponseSchema,
  },
  required: [
    'id',
    'userId',
    'title',
    'matterType',
    'status',
    'createdAt',
    'updatedAt',
    'attachedDocuments',
    'clauses',
    'drafts',
  ],
};
