import { FastifyRequest, FastifyReply } from 'fastify';
import * as billingRepo from '#domains/billing/billing.repository.js';
import { checkLimit, isSubscriptionActive } from '#domains/billing/billing.limits.js';
import { UsageMetric } from '#domains/billing/billing.types.js';

/**
 * planLimit — Fastify preHandler middleware factory
 *
 * Enforces subscription plan limits BEFORE any AI call or metered action runs.
 * Returns 402 for missing/inactive subscription, 429 for exceeded limits.
 *
 * Usage:
 *   app.post('/chat/stream', {
 *     preHandler: [authenticate, planLimit('ai_calls')],
 *     onResponse:  [trackAfterResponse('ai_calls')],
 *   }, handler)
 */
export function planLimit(metric: UsageMetric) {
  return async function checkPlanLimit(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {

    const { user } = request;
    const { firmId } = user;

    // Guard: firmId must be a real UUID — empty string means profile lookup failed
    if (!firmId) {
      reply.status(402).send({
        error: 'Firm not configured. Please complete your account setup.',
        setupUrl: '/onboarding',
      });
      return;
    }

    const { supabase } = request.server;

    // ── 1. Fetch subscription ────────────────────────────────────────────────
    const subscription = await billingRepo.getSubscriptionByFirm(supabase, firmId);

    if (!subscription) {
      reply.status(402).send({
        error: 'No active subscription. Please subscribe to continue.',
        subscribeUrl: '/billing/plans',
      });
      return;
    }

    // ── 2. Check subscription status is usable ───────────────────────────────
    if (!isSubscriptionActive(subscription.status, subscription.trialEndsAt)) {
      reply.status(402).send({
        error: `Your subscription is ${subscription.status}. Please update your billing.`,
        status: subscription.status,
        billingUrl: '/billing',
      });
      return;
    }

    // ── 3. Get current usage for this metric ─────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const currentUsage = metric === 'ai_calls'
      ? await billingRepo.getDailyUsage(supabase, firmId, metric, today)
      : await getTotalUsageForFirm(supabase, firmId, metric);

    // ── 4. Check against plan limits ─────────────────────────────────────────
    const limitCheck = checkLimit(subscription.plan, metric, currentUsage);

    if (!limitCheck.allowed) {
      request.log.warn(
        { firmId, metric, current: limitCheck.current, limit: limitCheck.limit },
        'Plan limit exceeded'
      );
      reply.status(429).send({
        error: limitCheck.reason,
        current: limitCheck.current,
        limit: limitCheck.limit,
        upgradeUrl: '/billing/plans',
      });
      return;
    }

    // ── 5. Attach subscription for downstream use ────────────────────────────
    request.subscription = subscription;
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getTotalUsageForFirm(
  supabase: ReturnType<typeof import('#utils/storage/supabaseClient.js').createSupabaseAdminClient>,
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
