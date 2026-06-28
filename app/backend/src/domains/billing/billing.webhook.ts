import { SupabaseClient } from '@supabase/supabase-js';
import * as repo from './billing.repository.js';
import { RazorpayEventType } from './billing.types.js';

// ─── Internal type for Razorpay webhook payload shape ────────────────────────

interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: RazorpayEventType;
  contains: string[];
  payload: {
    subscription?: {
      entity: {
        id: string;
        plan_id: string;
        status: string;
        current_start: number;    // Unix timestamp (seconds)
        current_end: number;      // Unix timestamp (seconds)
        customer_id: string;
        notes: { firm_id?: string };
      };
    };
    payment?: {
      entity: {
        id: string;
        amount: number;
        status: string;
        error_description?: string;
      };
    };
  };
  created_at: number;             // Unix timestamp (seconds)
}

/**
 * Process a verified Razorpay webhook event.
 *
 * Design decisions:
 * - Event stored to DB FIRST before any processing — enables replay on failure
 * - Idempotent — if same event_id arrives twice, second call is silently skipped
 * - Timestamps multiplied by 1000 — Razorpay sends Unix seconds, JS needs milliseconds
 * - payment.failed only logs — Razorpay retries automatically before halting
 * - markWebhookProcessed called in BOTH success and error paths
 */
export async function processWebhookEvent(
  supabase: SupabaseClient,
  eventId: string,
  payload: RazorpayWebhookPayload
): Promise<void> {

  // ── Step 1: Store the raw event before touching anything else ──────────────
  // If saveWebhookEvent returns false, this event_id already exists in DB.
  // That means we processed it before — safely skip to avoid double-counting.
  const isNew = await repo.saveWebhookEvent(supabase, {
    eventId,
    eventType: payload.event,
    payload: payload as unknown as Record<string, unknown>,
  });

  if (!isNew) {
    console.log(`[billing/webhook] Duplicate event ${eventId} — skipping`);
    return;
  }

  // ── Step 2: Process the event based on its type ────────────────────────────
  try {
    const subEntity = payload.payload.subscription?.entity;

    switch (payload.event) {

      // Firm's first payment succeeded — subscription is now live
      case 'subscription.activated': {
        if (!subEntity) break;
        const sub = await repo.getSubscriptionByRazorpayId(supabase, subEntity.id);
        if (!sub) {
          console.warn(`[billing/webhook] No subscription found for Razorpay ID ${subEntity.id}`);
          break;
        }
        await repo.updateSubscriptionStatus(supabase, sub.firmId, {
          status: 'active',
          razorpayCustomerId: subEntity.customer_id,
          currentPeriodStart: new Date(subEntity.current_start * 1000),
          currentPeriodEnd: new Date(subEntity.current_end * 1000),
        });
        console.log(`[billing/webhook] Firm ${sub.firmId} subscription activated`);
        break;
      }

      // Monthly renewal successful — refresh the billing period dates
      case 'subscription.charged': {
        if (!subEntity) break;
        const sub = await repo.getSubscriptionByRazorpayId(supabase, subEntity.id);
        if (!sub) break;
        await repo.updateSubscriptionStatus(supabase, sub.firmId, {
          status: 'active',
          currentPeriodStart: new Date(subEntity.current_start * 1000),
          currentPeriodEnd: new Date(subEntity.current_end * 1000),
        });
        console.log(`[billing/webhook] Firm ${sub.firmId} subscription renewed`);
        break;
      }

      // Payment failed after all Razorpay retries — block API access
      case 'subscription.halted': {
        if (!subEntity) break;
        const sub = await repo.getSubscriptionByRazorpayId(supabase, subEntity.id);
        if (!sub) break;
        await repo.updateSubscriptionStatus(supabase, sub.firmId, { status: 'halted' });
        console.warn(`[billing/webhook] Firm ${sub.firmId} subscription halted — payment failed`);
        // TODO: Send email alert to firm admin
        break;
      }

      // Firm cancelled their subscription
      case 'subscription.cancelled': {
        if (!subEntity) break;
        const sub = await repo.getSubscriptionByRazorpayId(supabase, subEntity.id);
        if (!sub) break;
        await repo.updateSubscriptionStatus(supabase, sub.firmId, { status: 'cancelled' });
        console.log(`[billing/webhook] Firm ${sub.firmId} subscription cancelled`);
        break;
      }

      // Single payment failed — Razorpay will retry automatically.
      // Do NOT change subscription status here. Just log for support visibility.
      case 'payment.failed': {
        const paymentErr = payload.payload.payment?.entity?.error_description;
        console.error(`[billing/webhook] Payment failed: ${paymentErr ?? 'unknown reason'}`);
        break;
      }
    }

    // ── Step 3: Mark event as successfully processed ─────────────────────────
    await repo.markWebhookProcessed(supabase, eventId);

  } catch (err) {
    // ── Step 4: Mark event with error so it can be replayed or investigated ──
    const errorMsg = err instanceof Error ? err.message : 'Unknown processing error';
    console.error(`[billing/webhook] Processing error for event ${eventId}:`, errorMsg);
    await repo.markWebhookProcessed(supabase, eventId, errorMsg);
    throw err; // Re-throw so the route layer knows something went wrong
  }
}
