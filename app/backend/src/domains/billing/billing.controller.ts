import { FastifyInstance, FastifyRequest } from 'fastify';
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
  // Public endpoint — no auth required.
  // Used by the onboarding page before a user has logged in.
  app.get('/plans', async (_request, reply) => {
    const plans = await repo.getAllPlans(app.supabase);
    return reply.send({ plans });
  });

  // ── POST /billing/trial ─────────────────────────────────────────────────────
  // Starts a 14-day free trial on the Starter plan.
  // Called automatically when a new firm completes signup.
  // Returns 409 if the firm already has a subscription.
  app.post('/trial', {
    preHandler: [authenticate],
    schema: {
      body: { type: 'object' },
    },
  }, async (request, reply) => {
    const user = request.user!;
    const firmId = user.firmId ?? '00000000-0000-0000-0000-000000000000';

    // Prevent creating duplicate subscriptions
    const existing = await repo.getSubscriptionByFirm(app.supabase, firmId);
    if (existing) {
      return reply.status(409).send({ error: 'Subscription already exists for this firm' });
    }

    const subscription = await startTrial(app.supabase, firmId);
    return reply.status(201).send({ subscription });
  });

  // ── POST /billing/subscribe ─────────────────────────────────────────────────
  // Creates a Razorpay subscription and returns a hosted payment link.
  // The firm clicks the link, pays on Razorpay's page, and the webhook
  // fires subscription.activated to update our DB.
  app.post('/subscribe', {
    preHandler: [authenticate],
    schema: subscribeJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const firmId = user.firmId ?? '00000000-0000-0000-0000-000000000000';
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
  // Returns the firm's current subscription including plan details.
  // Frontend uses this to show plan badge in the header and billing page.
  app.get('/subscription', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const firmId = user.firmId ?? '00000000-0000-0000-0000-000000000000';

    const subscription = await repo.getSubscriptionByFirm(app.supabase, firmId);
    if (!subscription) {
      return reply.status(404).send({ error: 'No subscription found for this firm' });
    }
    return reply.send({ subscription });
  });

  // ── GET /billing/usage ──────────────────────────────────────────────────────
  // Returns aggregated usage metrics for the current billing period.
  // Powers the usage dashboard with progress bars for AI calls, docs, seats, storage.
  app.get('/usage', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const firmId = user.firmId ?? '00000000-0000-0000-0000-000000000000';

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
  // Upgrades the firm to a higher plan.
  // Updates the Razorpay subscription and returns a link to confirm payment.
  app.post('/upgrade', {
    preHandler: [authenticate],
    schema: upgradeJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const firmId = user.firmId ?? '00000000-0000-0000-0000-000000000000';
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
  // Razorpay calls this URL when subscription events occur.
  //
  // Security: NO authenticate middleware — this is a public endpoint called by
  // Razorpay's servers, not our users. Instead we verify the HMAC-SHA256
  // signature using the webhook secret before processing anything.
  //
  // Flow: Verify sig → acknowledge 200 immediately → process event in background.
  // We acknowledge first because Razorpay will retry if we take >5s to respond.
  app.post('/webhook', async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'] as string | undefined;

    // Raw body needed for HMAC — Fastify parses JSON before we can read raw bytes.
    // The @fastify/raw-body plugin attaches rawBody to the request object.
    const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody;

    // ── Guard: reject if signature header is missing ──────────────────────────
    if (!signature || !rawBody) {
      return reply.status(400).send({ error: 'Missing signature or body' });
    }

    // ── Guard: reject if HMAC signature does not match ────────────────────────
    if (!verifyWebhookSignature(rawBody, signature)) {
      return reply.status(400).send({ error: 'Invalid webhook signature' });
    }

    // Parse the already-validated body
    const payload = request.body as {
      event: string;
      created_at: number;
      [key: string]: unknown;
    };

    // Build a stable idempotency key from event type + timestamp
    const eventId = `${payload.event}_${payload.created_at}`;

    // ── Acknowledge immediately so Razorpay doesn't retry ─────────────────────
    reply.status(200).send({ received: true });

    // ── Process in background — never blocks the HTTP response ────────────────
    processWebhookEvent(app.supabase, eventId, payload as never).catch(err => {
      console.error('[billing/webhook] Background processing error:', err);
    });
  });
}
