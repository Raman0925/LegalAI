// Profile update request body schema
export const updateProfileSchema = {
  type: 'object',
  properties: {
    full_name: { type: 'string', minLength: 1, maxLength: 200, nullable: true },
    avatar_url: { type: 'string', format: 'uri', nullable: true },
  },
  additionalProperties: false,
};

// Standard profile response schema (reused across routes)
export const profileResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    full_name: { type: 'string', nullable: true },
    avatar_url: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

// Standard error response schema
export const errorResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
};
