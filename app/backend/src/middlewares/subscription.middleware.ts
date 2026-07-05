import { FastifyRequest, FastifyReply } from 'fastify';
import * as billingRepo from '#domains/billing/billing.repository.js';
import { isSubscriptionActive } from '#domains/billing/billing.limits.js';

/**
 * requireActiveSubscription — Fastify preHandler middleware
 *
 * Enforces that the firm has an active (or trial/grace) subscription.
 * Use this for non-metered routes that still require subscription access
 * (e.g. dashboard, team management).
 *
 * For metered routes (AI calls, document creation), use planLimit() instead
 * as it also checks usage limits.
 *
 * Returns:
 * - 402 if no subscription exists
 * - 402 if subscription is inactive (cancelled, halted, expired trial)
 * - Attaches warning header during grace period
 */
export async function requireActiveSubscription(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { firmId } = request.user;

  if (!firmId) {
    reply.status(402).send({
      error: 'Firm not configured. Please complete your account setup.',
      setupUrl: '/onboarding',
    });
    return;
  }

  const { supabase } = request.server;

  const subscription = await billingRepo.getSubscriptionByFirm(supabase, firmId);

  if (!subscription) {
    reply.status(402).send({
      error: 'NO_SUBSCRIPTION',
      message: 'Please subscribe to continue.',
      subscribeUrl: '/billing/plans',
    });
    return;
  }

  if (!isSubscriptionActive(subscription.status, subscription.trialEndsAt, subscription.gracePeriodEnd)) {
    reply.status(402).send({
      error: 'SUBSCRIPTION_INACTIVE',
      message: 'Your subscription has ended. Please renew to continue.',
      status: subscription.status,
      billingUrl: '/billing',
    });
    return;
  }

  // Warn during grace period — frontend can show a banner
  if (subscription.status === 'grace_period') {
    request.subscriptionWarning = {
      message: 'Payment failed. Update your payment method to avoid service interruption.',
      gracePeriodEnd: subscription.gracePeriodEnd,
    };
  }

  // Attach subscription for downstream use
  request.subscription = subscription;
}
