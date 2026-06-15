export const chatRequestSchema = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      minLength: 1,
    },
    history: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['user', 'assistant', 'system'],
          },
          content: {
            type: 'string',
          },
        },
        required: ['role', 'content'],
        additionalProperties: false,
      },
      default: [],
    },
    tier: {
      type: 'string',
      enum: ['fast', 'balanced', 'powerful'],
      default: 'balanced',
    },
  },
  required: ['message'],
  additionalProperties: false,
};

export const chatResponseSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    usage: {
      type: 'object',
      properties: {
        inputTokens: { type: 'number' },
        outputTokens: { type: 'number' },
      },
      required: ['inputTokens', 'outputTokens'],
    },
  },
  required: ['text', 'usage'],
};

export const errorResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
};
