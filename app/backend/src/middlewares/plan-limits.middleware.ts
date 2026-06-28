import { FastifyRequest, FastifyReply } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import * as billingRepo from '#domains/billing/billing.repository.js';
import { checkLimit, isSubscriptionActive } from '#domains/billing/billing.limits.js';
import { UsageMetric } from '#domains/billing/billing.types.js';

/**
 * planLimit — Fastify preHandler middleware factory
 *
 * Use this to protect any route that consumes a metered resource.
 * It runs BEFORE the route handler, so limits are enforced before
 * any AI call or DB write happens.
 *
 * Usage in a route:
 *   app.post('/chat', {
 *     preHandler: [authenticate, planLimit('ai_calls')],
 *   }, handler)
 *
 * What it does:
 *   1. Looks up the firm's active subscription from DB
 *   2. Checks if subscription is active (not cancelled, halted, expired trial)
 *   3. Gets current usage for the requested metric
 *   4. Checks usage against plan limits
 *   5. Returns 402 if no subscription, 429 if limit exceeded
 *   6. Attaches subscription to request for downstream use if allowed
 */
export function planLimit(metric: UsageMetric) {
  return async function checkPlanLimit(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {

    const user = request.user;
    if (!user) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    const firmId = user.firmId ?? '00000000-0000-0000-0000-000000000000';
    const supabase = request.server.supabase as SupabaseClient;

    // ── Step 1: Get firm's subscription ───────────────────────────────────────
    const subscription = await billingRepo.getSubscriptionByFirm(supabase, firmId);

    if (!subscription) {
      reply.status(402).send({
        error: 'No active subscription. Please subscribe to continue.',
        subscribeUrl: '/billing/plans',
      });
      return;
    }

    // ── Step 2: Check subscription is in a usable state ───────────────────────
    // Active and valid trials are allowed. Halted, cancelled, past_due are blocked.
    if (!isSubscriptionActive(subscription.status, subscription.trialEndsAt)) {
      reply.status(402).send({
        error: `Your subscription is ${subscription.status}. Please update your billing to continue.`,
        status: subscription.status,
        billingUrl: '/billing',
      });
      return;
    }

    // ── Step 3: Get current usage for this metric ──────────────────────────────
    // ai_calls resets daily — check today's count only
    // documents_created is a lifetime total — check all-time count
    const today = new Date().toISOString().slice(0, 10);
    const currentUsage = metric === 'ai_calls'
      ? await billingRepo.getDailyUsage(supabase, firmId, metric, today)
      : await getTotalUsageForFirm(supabase, firmId, metric);

    // ── Step 4: Check against plan limits ─────────────────────────────────────
    const limitCheck = checkLimit(subscription.plan, metric, currentUsage);

    if (!limitCheck.allowed) {
      reply.status(429).send({
        error: limitCheck.reason,
        current: limitCheck.current,
        limit: limitCheck.limit,
        upgradeUrl: '/billing/plans',
      });
      return;
    }

    // ── Step 5: Attach subscription for downstream handlers ───────────────────
    // Route handlers can read request.subscription without another DB call
    (request as FastifyRequest & { subscription: typeof subscription }).subscription = subscription;
  };
}

// ─── Helper: total usage across all dates for non-daily metrics ──────────────

async function getTotalUsageForFirm(
  supabase: SupabaseClient,
  firmId: string,
  metric: UsageMetric
): Promise<number> {
  const { data } = await supabase
    .from('usage_records')
    .select('quantity')
    .eq('firm_id', firmId)
    .eq('metric', metric);

  return (data ?? []).reduce(
    (sum: number, row: { quantity: number }) => sum + row.quantity,
    0
  );
}
