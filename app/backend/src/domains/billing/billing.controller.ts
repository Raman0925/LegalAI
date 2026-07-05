import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
import { requireFirmOwner } from '#middlewares/billing-owner.middleware.js';
import * as repo from './billing.repository.js';
import {
  createRazorpaySubscription,
  startTrial,
  verifyWebhookSignature,
  createUpgradeLink,
  createOrder,
  verifyPayment,
} from './billing.service.js';
import { processWebhookEvent } from './billing.webhook.js';
import {
  SelectPlanSchema,
  UpgradePlanSchema,
  CreateOrderSchema,
  VerifyPaymentSchema,
  subscribeJsonSchema,
  upgradeJsonSchema,
  createOrderJsonSchema,
  verifyPaymentJsonSchema,
} from './billing.schema.js';

export async function billingController(app: FastifyInstance) {

  // ── GET /billing/plans ──────────────────────────────────────────────────────
  // Public — no auth. Shown on the onboarding/pricing page before signup.
  app.get('/plans', async (_request, reply) => {
    const plans = await repo.getAllPlans(app.supabase);
    return reply.send({ plans });
  });

  // ── POST /billing/trial ─────────────────────────────────────────────────────
  // Start a 14-day free trial on the Starter plan.
  // Called automatically on new firm signup. Returns 409 if already subscribed.
  app.post('/trial', {
    preHandler: [authenticate],
    schema: { body: { type: 'object' } },
  }, async (request, reply) => {
    const { firmId } = request.user;

    const existing = await repo.getSubscriptionByFirm(app.supabase, firmId);
    if (existing) {
      return reply.status(409).send({ error: 'Subscription already exists for this firm' });
    }

    const subscription = await startTrial(app.supabase, firmId);
    return reply.status(201).send({ subscription });
  });

  // ── POST /billing/subscribe ─────────────────────────────────────────────────
  // Create a Razorpay subscription and return a hosted payment link.
  // After the firm pays on Razorpay's page, the webhook updates our DB.
  app.post('/subscribe', {
    preHandler: [authenticate, requireFirmOwner],
    schema: subscribeJsonSchema,
  }, async (request, reply) => {
    const { firmId } = request.user;
    const body = SelectPlanSchema.parse(request.body);

    try {
      const result = await createRazorpaySubscription(app.supabase, {
        firmId,
        planName: body.planName,
        firmName: body.firmName,
        firmEmail: body.firmEmail,
      });
      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Subscription creation failed';
      return reply.status(400).send({ error: message });
    }
  });

  // ── POST /billing/orders ────────────────────────────────────────────────────
  // Create a Razorpay order for the Checkout modal flow.
  // Amount is looked up server-side — never from client request.
  // Only firm owners can create orders.
  app.post('/orders', {
    preHandler: [authenticate, requireFirmOwner],
    schema: createOrderJsonSchema,
  }, async (request, reply) => {
    const { firmId } = request.user;

    const body = CreateOrderSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });
    }

    try {
      const result = await createOrder(app.supabase, {
        firmId,
        planName: body.data.planName,
        billingCycle: body.data.billingCycle,
      });
      return reply.status(201).send(result);
    } catch (err: any) {
      if (err.message === 'ORDER_IN_PROGRESS') {
        return reply.status(409).send({ error: 'ORDER_IN_PROGRESS', retryAfter: 3 });
      }
      request.log.error(err, 'Failed to create order');
      return reply.status(400).send({ error: err.message ?? 'Failed to create order' });
    }
  });

  // ── POST /billing/verify ────────────────────────────────────────────────────
  // Verify Razorpay payment signature and activate subscription.
  // HMAC-SHA256 verification + tenant ownership + session expiry check.
  app.post('/verify', {
    preHandler: [authenticate],
    schema: verifyPaymentJsonSchema,
  }, async (request, reply) => {
    const { firmId } = request.user;

    const body = VerifyPaymentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: body.error.flatten() });
    }

    try {
      const result = await verifyPayment(app.supabase, {
        firmId,
        razorpayOrderId: body.data.razorpay_order_id,
        razorpayPaymentId: body.data.razorpay_payment_id,
        razorpaySignature: body.data.razorpay_signature,
      });
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.message === 'SIGNATURE_MISMATCH') {
        return reply.status(400).send({ error: 'VERIFICATION_FAILED' });
      }
      if (err.message === 'SESSION_EXPIRED') {
        return reply.status(410).send({ error: 'SESSION_EXPIRED' });
      }
      if (err.message === 'ORDER_NOT_FOUND') {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      if (err.message === 'UNAUTHORIZED') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }
      request.log.error(err, 'Payment verification failed');
      throw err;
    }
  });

  // ── GET /billing/payments ───────────────────────────────────────────────────
  // Returns payment history for the firm.
  app.get('/payments', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { firmId } = request.user;
    const payments = await repo.getPaymentHistory(app.supabase, firmId);
    return reply.send({ payments });
  });

  // ── GET /billing/subscription ───────────────────────────────────────────────
  // Returns the firm's current subscription + plan details.
  // Frontend uses this to render the plan badge and billing page.
  app.get('/subscription', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { firmId } = request.user;
    const subscription = await repo.getSubscriptionByFirm(app.supabase, firmId);

    if (!subscription) {
      return reply.status(404).send({ error: 'No subscription found for this firm' });
    }
    return reply.send({ subscription });
  });

  // ── GET /billing/usage ──────────────────────────────────────────────────────
  // Returns aggregated usage metrics for the current billing period.
  // Powers the usage dashboard with progress bars.
  app.get('/usage', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { firmId } = request.user;
    const subscription = await repo.getSubscriptionByFirm(app.supabase, firmId);

    if (!subscription) {
      return reply.status(404).send({ error: 'No subscription found for this firm' });
    }

    const summary = await repo.getUsageSummary(
      app.supabase,
      firmId,
      subscription.plan,
      subscription.seatCount
    );

    return reply.send({ usage: summary, plan: subscription.plan });
  });

  // ── GET /billing/overview ───────────────────────────────────────────────────
  // Combined response: subscription + invoices + payment history.
  // Powers the full billing dashboard.
  app.get('/overview', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { firmId } = request.user;

    const [subscription, invoices, payments] = await Promise.all([
      repo.getSubscriptionByFirm(app.supabase, firmId),
      repo.getInvoicesByFirm(app.supabase, firmId),
      repo.getPaymentHistory(app.supabase, firmId, 10),
    ]);

    return reply.send({
      subscription: subscription ?? null,
      invoices,
      payments,
    });
  });

  // ── POST /billing/upgrade ───────────────────────────────────────────────────
  // Upgrades firm to a higher plan via Razorpay and returns a confirmation link.
  app.post('/upgrade', {
    preHandler: [authenticate, requireFirmOwner],
    schema: upgradeJsonSchema,
  }, async (request, reply) => {
    const { firmId } = request.user;

    const { planName } = UpgradePlanSchema.parse(request.body);

    try {
      const upgradeUrl = await createUpgradeLink(app.supabase, firmId, planName);
      return reply.send({ upgradeUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upgrade failed';
      return reply.status(400).send({ error: message });
    }
  });

  // ── POST /billing/webhook ───────────────────────────────────────────────────
  // Public endpoint — called by Razorpay, NOT by our users.
  // Security: HMAC-SHA256 signature verified before any processing.
  // ALWAYS returns 200 — even on invalid signature or errors.
  // Returning 4xx causes Razorpay to retry, which we don't want for invalid events.
  app.post('/webhook', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = request.rawBody;

    // Guard: both signature and raw body must be present
    if (!signature || !rawBody) {
      request.log.warn('Webhook received without signature or body');
      return reply.status(200).send({ received: true });
    }

    // Guard: reject if HMAC does not match — always return 200
    if (!verifyWebhookSignature(rawBody, signature)) {
      request.log.warn('Webhook signature verification failed');
      return reply.status(200).send({ received: true });
    }

    const payload = request.body as {
      id?: string;
      event: string;
      created_at: number;
      [key: string]: unknown;
    };

    // Replay attack protection — reject events older than 5 minutes
    const eventAgeMs = Date.now() - (payload.created_at * 1000);
    if (eventAgeMs > 5 * 60 * 1000) {
      request.log.warn({ eventId: payload.id }, 'Stale webhook rejected (>5 min old)');
      return reply.status(200).send({ received: true });
    }

    // Stable idempotency key: use Razorpay's actual event ID if present
    const eventId = payload.id || `${payload.event}_${payload.created_at}`;

    // Acknowledge immediately — Razorpay retries if we take >5s
    reply.status(200).send({ received: true });

    // Process in background — never blocks the HTTP response
    processWebhookEvent(app.supabase, eventId, payload as never).catch(err => {
      request.log.error({ eventId, err }, 'Webhook background processing failed');
    });
  });
}
