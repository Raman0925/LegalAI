import { z } from 'zod';

export const CreateFirmSchema = z.object({
  firmName: z
    .string()
    .min(2, 'Firm name must be at least 2 characters')
    .max(200, 'Firm name too long')
    .trim(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const JoinFirmSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Fastify JSON schemas
export const createFirmJsonSchema = {
  body: {
    type: 'object' as const,
    required: ['firmName'],
    properties: {
      firmName: { type: 'string' as const, minLength: 2, maxLength: 200 },
    },
  },
};

export const inviteMemberJsonSchema = {
  body: {
    type: 'object' as const,
    required: ['email'],
    properties: {
      email: { type: 'string' as const, format: 'email' },
    },
  },
};

export const joinFirmJsonSchema = {
  body: {
    type: 'object' as const,
    required: ['token'],
    properties: {
      token: { type: 'string' as const, minLength: 1 },
    },
  },
};
