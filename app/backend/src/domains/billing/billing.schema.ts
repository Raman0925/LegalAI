import { z } from 'zod';

// ─── Zod Schemas (runtime validation) ────────────────────────────────────────

export const SelectPlanSchema = z.object({
  planName: z.enum(['starter', 'growth', 'pro']),
  firmName: z.string().min(1).max(200),
  firmEmail: z.string().email(),
});

export const UpgradePlanSchema = z.object({
  planName: z.enum(['starter', 'growth', 'pro', 'enterprise']),
});

// ─── Fastify JSON Schemas (request validation + swagger docs) ────────────────

export const subscribeJsonSchema = {
  body: {
    type: 'object',
    required: ['planName', 'firmName', 'firmEmail'],
    properties: {
      planName: { type: 'string', enum: ['starter', 'growth', 'pro'] },
      firmName: { type: 'string', minLength: 1, maxLength: 200 },
      firmEmail: { type: 'string', format: 'email' },
    },
  },
};

export const upgradeJsonSchema = {
  body: {
    type: 'object',
    required: ['planName'],
    properties: {
      planName: { type: 'string', enum: ['starter', 'growth', 'pro', 'enterprise'] },
    },
  },
};
