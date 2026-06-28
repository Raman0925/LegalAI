import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
import * as repo from './billing.repository.js';
import {
  createRazorpaySubscription,
  startTrial,
  verifyWebhookSignature,
  createUpgradeLink,
} from './billing.service.js';
import { processWebhookEvent } from './billing.webhook.js';
import {
  SelectPlanSchema,
  UpgradePlanSchema,
  subscribeJsonSchema,
  upgradeJsonSchema,
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
    preHandler: [authenticate],
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

  // ── POST /billing/upgrade ───────────────────────────────────────────────────
  // Upgrades firm to a higher plan via Razorpay and returns a confirmation link.
  app.post('/upgrade', {
    preHandler: [authenticate],
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
  // config.rawBody = true tells @fastify/raw-body to attach the raw request body
  // so we can compute the HMAC over the exact bytes Razorpay signed.
  app.post('/webhook', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = request.rawBody;

    // Guard: both signature and raw body must be present
    if (!signature || !rawBody) {
      request.log.warn('Webhook received without signature or body');
      return reply.status(400).send({ error: 'Missing signature or body' });
    }

    // Guard: reject if HMAC does not match — stops forged requests
    if (!verifyWebhookSignature(rawBody, signature)) {
      request.log.warn('Webhook signature verification failed');
      return reply.status(400).send({ error: 'Invalid webhook signature' });
    }

    const payload = request.body as {
      event: string;
      created_at: number;
      [key: string]: unknown;
    };

    // Stable idempotency key: event type + unix timestamp
    const eventId = `${payload.event}_${payload.created_at}`;

    // Acknowledge immediately — Razorpay retries if we take >5s
    reply.status(200).send({ received: true });

    // Process in background — never blocks the HTTP response
    processWebhookEvent(app.supabase, eventId, payload as never).catch(err => {
      request.log.error({ eventId, err }, 'Webhook background processing failed');
    });
  });
}
