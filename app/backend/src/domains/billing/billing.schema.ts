import { z } from 'zod';

// ─── Zod Schemas (runtime validation) ────────────────────────────────────────

export const CreateOrderSchema = z.object({
  planName: z.enum(['starter', 'growth', 'pro']),
  billingCycle: z.enum(['monthly', 'yearly']),
});

export const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().startsWith('order_'),
  razorpay_payment_id: z.string().startsWith('pay_'),
  razorpay_signature: z.string().min(1),
});

// ─── Fastify JSON Schemas (request validation + swagger docs) ────────────────


export const createOrderJsonSchema = {
  body: {
    type: 'object',
    required: ['planName', 'billingCycle'],
    properties: {
      planName: { type: 'string', enum: ['starter', 'growth', 'pro'] },
      billingCycle: { type: 'string', enum: ['monthly', 'yearly'] },
    },
  },
};

export const verifyPaymentJsonSchema = {
  body: {
    type: 'object',
    required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
    properties: {
      razorpay_order_id: { type: 'string' },
      razorpay_payment_id: { type: 'string' },
      razorpay_signature: { type: 'string' },
    },
  },
};
