import Razorpay from 'razorpay';
import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import * as repo from './billing.repository.js';
import { config } from '../../config/index.js';
import { FirmSubscription, CreateOrderResponse, Payment } from './billing.types.js';
import { generateIdempotencyKey } from '../../utils/idempotency.js';

// ─── Razorpay client (lazy-init to avoid throwing at module load) ────────────

let razorpayClient: Razorpay | null = null;
function getRazorpay(): Razorpay {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    });
  }
  return razorpayClient;
}

// ─── Plan price lookup (server-side only — never trust the client) ───────────

/**
 * Monthly prices in paise. Yearly = monthly * 10 (2 months free).
 * These come from your subscription_plans table in DB.
 * Prices MUST be looked up server-side from the DB — never from the client.
 */
export async function getPlanPrice(
  supabase: SupabaseClient,
  planName: string,
  billingCycle: 'monthly' | 'yearly'
): Promise<number> {
  const plan = await repo.getPlanByName(supabase, planName);
  if (!plan) throw new Error(`Plan not found: ${planName}`);

  if (billingCycle === 'monthly') return plan.priceInr;
  // Yearly: 10 months price (2 months free)
  return Math.round(plan.priceInr * 10);
}

// Time before a "creating" row is considered stuck (2 minutes)
const STUCK_TIMEOUT_MS = 2 * 60 * 1000;

// ─── Create Razorpay Order (Checkout modal flow) ─────────────────────────────

/**
 * Creates a Razorpay order for the Checkout modal payment flow.
 *
 * Idempotent: same firm + plan + cycle within the same hour returns existing order.
 * Handles stuck rows (status='creating' for >2 min) by marking them failed.
 *
 * Security: amount comes from server-side plan config, never from client.
 */
export async function createOrder(
  supabase: SupabaseClient,
  params: {
    firmId: string;
    planName: string;
    billingCycle: 'monthly' | 'yearly';
  }
): Promise<CreateOrderResponse> {
  const { firmId, planName, billingCycle } = params;
  const amountPaise = await getPlanPrice(supabase, planName, billingCycle);
  const idempotencyKey = generateIdempotencyKey(firmId, planName, billingCycle);
  const receipt = crypto.randomUUID();

  // Try to insert a new payment row
  const paymentRowId = await repo.createPaymentRecord(supabase, {
    firmId,
    amountPaise,
    idempotencyKey,
    metadata: { receipt, planName, billingCycle },
  });

  // Row already exists — return existing or handle stuck state
  if (!paymentRowId) {
    const existing = await repo.getPaymentByIdempotencyKey(supabase, idempotencyKey);
    if (!existing) throw new Error('Payment record conflict');

    // Already created successfully — return existing order
    if (existing.status === 'created' && existing.razorpayOrderId) {
      return {
        orderId: existing.razorpayOrderId,
        amount: existing.amountPaise,
        currency: 'INR',
        keyId: config.razorpayKeyId,
      };
    }

    // Stuck in "creating" state
    if (existing.status === 'creating') {
      const ageMs = Date.now() - existing.createdAt.getTime();
      if (ageMs < STUCK_TIMEOUT_MS) {
        throw new Error('ORDER_IN_PROGRESS');
      }

      // Stuck too long — mark as failed so user can retry next hour
      await repo.updatePaymentStatus(supabase, existing.id, { status: 'failed' });
      throw new Error('Previous order timed out. Please try again.');
    }

    // Already captured/failed — user needs to wait for next idempotency window
    if (existing.status === 'captured') {
      throw new Error('Payment already completed for this plan.');
    }

    throw new Error('Previous order failed. Please try again.');
  }

  // Create order on Razorpay
  let razorpayOrder: any;
  try {
    razorpayOrder = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        firm_id: firmId,
        plan_name: planName,
        billing_cycle: billingCycle,
        payment_row_id: paymentRowId,
      },
    });
  } catch (err) {
    await repo.updatePaymentStatus(supabase, paymentRowId, { status: 'failed' });
    throw new Error('Failed to create payment order. Please try again.');
  }

  // Update our row with Razorpay order ID
  await repo.updatePaymentStatus(supabase, paymentRowId, {
    razorpayOrderId: razorpayOrder.id,
    status: 'created',
  });

  // Audit log
  await repo.createPaymentEvent(supabase, {
    paymentId: paymentRowId,
    firmId,
    eventType: 'order.created',
    fromStatus: 'creating',
    toStatus: 'created',
    amountPaise,
    rawPayload: razorpayOrder as Record<string, unknown>,
  });

  return {
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: config.razorpayKeyId,
  };
}

// ─── Verify Payment (after Checkout callback) ────────────────────────────────

/**
 * Verifies the Razorpay payment signature (HMAC-SHA256) and activates the subscription.
 *
 * Security:
 * - Signature verified with crypto.timingSafeEqual (not ===)
 * - Tenant ownership verified (payment.firmId === JWT firmId)
 * - Session expiry checked
 * - Idempotent: returns success if already captured
 */
export async function verifyPayment(
  supabase: SupabaseClient,
  params: {
    firmId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }
): Promise<{ success: boolean; subscriptionStatus: string }> {
  const { firmId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

  // Step 1: HMAC signature verification — MUST be done FIRST
  const message = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', config.razorpayKeySecret)
    .update(message)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(razorpaySignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('SIGNATURE_MISMATCH');
  }

  // Step 2: Look up the payment
  const payment = await repo.getPaymentByOrderId(supabase, razorpayOrderId);
  if (!payment) throw new Error('ORDER_NOT_FOUND');

  // Step 3: Verify tenant ownership
  if (payment.firmId !== firmId) throw new Error('UNAUTHORIZED');

  // Step 4: Check session expiry
  if (payment.expiresAt && new Date() > payment.expiresAt) {
    throw new Error('SESSION_EXPIRED');
  }

  // Step 5: Idempotent — already captured
  if (payment.status === 'captured') {
    return { success: true, subscriptionStatus: 'active' };
  }

  // Step 6: Mark as captured
  await repo.updatePaymentStatus(supabase, payment.id, {
    razorpayPaymentId,
    status: 'captured',
  });

  // Step 7: Audit log
  await repo.createPaymentEvent(supabase, {
    paymentId: payment.id,
    firmId,
    eventType: 'payment.verified',
    fromStatus: payment.status,
    toStatus: 'captured',
    rawPayload: { razorpayPaymentId },
  });

  // Step 8: Activate subscription
  await activateSubscription(supabase, firmId, payment);

  return { success: true, subscriptionStatus: 'active' };
}

// ─── Activate Subscription (idempotent) ──────────────────────────────────────

/**
 * Activates (or renews) a subscription after successful payment.
 * Called from BOTH verifyPayment AND webhook handler — intentionally.
 * The webhook is the safety net for when the verify endpoint fails.
 *
 * Idempotent: uses upsertSubscription which does ON CONFLICT UPDATE.
 */
export async function activateSubscription(
  supabase: SupabaseClient,
  firmId: string,
  payment: Payment
): Promise<void> {
  const metadata = payment.metadata as { planName?: string; billingCycle?: string };
  const planName = metadata.planName;
  const billingCycle = metadata.billingCycle;

  if (!planName || !billingCycle) {
    console.error('[billing] Cannot activate subscription — missing plan metadata on payment', payment.id);
    return;
  }

  const periodStart = new Date();
  const periodEnd = new Date();
  if (billingCycle === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  await repo.upsertSubscription(supabase, {
    firmId,
    planName,
    amountPaise: payment.amountPaise,
    periodStart,
    periodEnd,
  });

  // Generate invoice
  const invoiceNumber = `INV-${Date.now()}-${firmId.slice(0, 8)}`;
  const taxRate = 0.18; // 18% GST
  const taxPaise = Math.round(payment.amountPaise * taxRate);

  // We don't yet capture the firm's registered state, so we can't tell
  // intra-state (CGST+SGST) from inter-state (IGST) supply. Bucket the
  // full tax under IGST — the safer default for a SaaS billed pan-India —
  // rather than leaving all three columns at 0 while tax_paise is non-zero.
  await repo.createInvoice(supabase, {
    firmId,
    paymentId: payment.id,
    invoiceNumber,
    amountPaise: payment.amountPaise,
    taxPaise,
    totalPaise: payment.amountPaise + taxPaise,
    gstinSupplier: config.gstin || undefined,
    igstPaise: taxPaise,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
  });
}

// ─── Existing functions (preserved from original) ────────────────────────────

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
