import Razorpay from 'razorpay';
import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import * as repo from './billing.repository.js';
import { config } from '../../config/index.js';
import { FirmSubscription } from './billing.types.js';

// Single Razorpay client instance
const razorpay = new Razorpay({
  key_id: config.razorpayKeyId,
  key_secret: config.razorpayKeySecret,
});

/**
 * Create a Razorpay subscription for a firm.
 * Called during firm onboarding after plan selection.
 */
export async function createRazorpaySubscription(
  supabase: SupabaseClient,
  params: {
    firmId: string;
    firmName: string;
    firmEmail: string;
    planName: string;
  }
): Promise<{ subscriptionId: string; shortUrl: string }> {
  const plan = await repo.getPlanByName(supabase, params.planName);
  if (!plan) throw new Error('Plan not found');
  if (!plan.razorpayPlanId) throw new Error('Plan not configured in Razorpay');

  // Create Razorpay subscription
  const subscription = await razorpay.subscriptions.create({
    plan_id: plan.razorpayPlanId,
    customer_notify: 1,
    quantity: 1,
    total_count: 120,     // 10 years max
    notes: {
      firm_id: params.firmId,
      firm_name: params.firmName,
    },
  });

  // Save to DB
  await repo.createSubscription(supabase, {
    firmId: params.firmId,
    planId: plan.id,
    razorpaySubscriptionId: subscription.id as string,
    status: 'pending',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 day trial
  });

  return {
    subscriptionId: subscription.id as string,
    shortUrl: (subscription as any).short_url as string ?? '',
  };
}

/**
 * Start a 14-day trial for a new firm (no payment required).
 */
export async function startTrial(
  supabase: SupabaseClient,
  firmId: string
): Promise<FirmSubscription> {
  const starterPlan = await repo.getPlanByName(supabase, 'starter');
  if (!starterPlan) throw new Error('Starter plan not found');

  return repo.createSubscription(supabase, {
    firmId,
    planId: starterPlan.id,
    status: 'trial',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
}

/**
 * Verify Razorpay webhook signature.
 * MUST be called before processing any webhook event.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', config.razorpayWebhookSecret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expectedSignature);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Get current subscription with plan for a firm.
 * Cached in JWT — but verify from DB on sensitive operations.
 */
export async function getFirmSubscription(
  supabase: SupabaseClient,
  firmId: string
): Promise<FirmSubscription | null> {
  return repo.getSubscriptionByFirm(supabase, firmId);
}

/**
 * Generate Razorpay payment link for plan upgrade.
 */
export async function createUpgradeLink(
  supabase: SupabaseClient,
  firmId: string,
  newPlanName: string
): Promise<string> {
  const plan = await repo.getPlanByName(supabase, newPlanName);
  if (!plan) throw new Error('Plan not found');

  const sub = await repo.getSubscriptionByFirm(supabase, firmId);
  if (!sub?.razorpaySubscriptionId) throw new Error('No active subscription');

  // Update Razorpay subscription plan
  await razorpay.subscriptions.update(sub.razorpaySubscriptionId, {
    plan_id: plan.razorpayPlanId!,
    quantity: 1,
  } as any);

  return `https://dashboard.razorpay.com/app/subscriptions/${sub.razorpaySubscriptionId}`;
}
