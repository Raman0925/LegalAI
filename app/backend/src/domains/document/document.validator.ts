export const documentResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    fileType: { type: 'string', enum: ['pdf', 'docx', 'txt', 'image'] },
    sizeBytes: { type: 'number', nullable: true },
    status: { type: 'string', enum: ['pending', 'processing', 'ready', 'failed'] },
    chunkCount: { type: 'number' },
    errorMsg: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'fileType', 'status', 'chunkCount', 'createdAt', 'updatedAt'],
};

export const documentListResponseSchema = {
  type: 'array',
  items: documentResponseSchema,
};

export const uploadResponseSchema = {
  type: 'object',
  properties: {
    documentId: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: ['pending'] },
  },
  required: ['documentId', 'status'],
};

export const statusResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pending', 'processing', 'ready', 'failed'] },
    chunkCount: { type: 'number' },
    errorMsg: { type: 'string', nullable: true },
  },
  required: ['status', 'chunkCount'],
};

export const errorResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
};
