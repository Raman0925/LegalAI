import { SupabaseClient } from '@supabase/supabase-js';
import * as repo from './billing.repository.js';
import { activateSubscription } from './billing.service.js';
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
        method: string;
        order_id: string;
        error_code?: string;
        error_description?: string;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        amount: number;
        status: string;
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
    const payEntity = payload.payload.payment?.entity;

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
          gracePeriodEnd: null,
        });
        console.log(`[billing/webhook] Firm ${sub.firmId} subscription renewed`);
        break;
      }

      // Payment failed after all Razorpay retries — enter grace period
      // Give the firm 7 days to update their payment method before restricting access
      case 'subscription.halted': {
        if (!subEntity) break;
        const sub = await repo.getSubscriptionByRazorpayId(supabase, subEntity.id);
        if (!sub) break;

        const gracePeriodEnd = new Date();
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

        await repo.updateSubscriptionStatus(supabase, sub.firmId, {
          status: 'grace_period',
          gracePeriodEnd,
        });
        console.warn(`[billing/webhook] Firm ${sub.firmId} entering grace period (7 days) — payment failed`);
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

      // Payment captured — one-time order payment confirmed
      // This is the SAFETY NET: if the verify endpoint failed, this handler
      // still activates the subscription so the user isn't stuck.
      case 'payment.captured': {
        if (!payEntity) break;

        const dbPayment = await repo.getPaymentByOrderId(supabase, payEntity.order_id);
        if (!dbPayment) {
          console.warn(`[billing/webhook] No payment found for order ${payEntity.order_id}`);
          break;
        }

        // Idempotent — already captured
        if (dbPayment.status === 'captured') break;

        // Security: amount must match what we quoted at order-creation time.
        // Razorpay Checkout cannot alter the order amount, but this guards
        // against a corrupted/tampered order or a bug in order creation.
        if (payEntity.amount !== dbPayment.amountPaise) {
          console.error(
            `[billing/webhook] AMOUNT MISMATCH for order ${payEntity.order_id} — expected ${dbPayment.amountPaise}, received ${payEntity.amount}. Refusing to activate subscription.`
          );
          await repo.createPaymentEvent(supabase, {
            paymentId: dbPayment.id,
            firmId: dbPayment.firmId,
            razorpayEventId: eventId,
            eventType: 'payment.amount_mismatch',
            fromStatus: dbPayment.status,
            toStatus: dbPayment.status,
            amountPaise: payEntity.amount,
            errorCode: 'AMOUNT_MISMATCH',
            errorDescription: `Expected ${dbPayment.amountPaise}, received ${payEntity.amount}`,
            rawPayload: payload as unknown as Record<string, unknown>,
          });
          break;
        }

        // Audit log
        await repo.createPaymentEvent(supabase, {
          paymentId: dbPayment.id,
          firmId: dbPayment.firmId,
          razorpayEventId: eventId,
          eventType: 'payment.captured',
          fromStatus: dbPayment.status,
          toStatus: 'captured',
          amountPaise: payEntity.amount,
          rawPayload: payload as unknown as Record<string, unknown>,
        });

        // Update payment status
        await repo.updatePaymentStatus(supabase, dbPayment.id, {
          razorpayPaymentId: payEntity.id,
          status: 'captured',
          paymentMethod: payEntity.method,
        });

        // Safety net — activate subscription even if verify endpoint failed
        await activateSubscription(supabase, dbPayment.firmId, dbPayment);
        console.log(`[billing/webhook] Payment captured for firm ${dbPayment.firmId}`);
        break;
      }

      // Single payment failed — Razorpay will retry automatically.
      // Do NOT change subscription status here. Just log for support visibility.
      case 'payment.failed': {
        if (!payEntity) break;

        // Update the payment record with error details
        if (payEntity.order_id) {
          const dbPayment = await repo.getPaymentByOrderId(supabase, payEntity.order_id);
          if (dbPayment) {
            await repo.updatePaymentStatus(supabase, dbPayment.id, {
              status: 'failed',
              metadata: {
                ...dbPayment.metadata,
                error_code: payEntity.error_code,
                error_description: payEntity.error_description,
              },
            });

            await repo.createPaymentEvent(supabase, {
              paymentId: dbPayment.id,
              firmId: dbPayment.firmId,
              razorpayEventId: eventId,
              eventType: 'payment.failed',
              toStatus: 'failed',
              errorCode: payEntity.error_code,
              errorDescription: payEntity.error_description,
              rawPayload: payload as unknown as Record<string, unknown>,
            });
          }
        }

        console.error(`[billing/webhook] Payment failed: ${payEntity.error_description ?? 'unknown reason'}`);
        break;
      }

      // Refund created — mark payment as refunded
      case 'refund.created': {
        const refundEntity = payload.payload.refund?.entity;
        if (!refundEntity) break;

        const dbPayment = await repo.getPaymentByOrderId(supabase, refundEntity.payment_id);
        if (dbPayment) {
          await repo.updatePaymentStatus(supabase, dbPayment.id, { status: 'refunded' });
          await repo.createPaymentEvent(supabase, {
            paymentId: dbPayment.id,
            firmId: dbPayment.firmId,
            razorpayEventId: eventId,
            eventType: 'refund.created',
            fromStatus: dbPayment.status,
            toStatus: 'refunded',
            amountPaise: refundEntity.amount,
            rawPayload: payload as unknown as Record<string, unknown>,
          });
          console.log(`[billing/webhook] Payment ${dbPayment.id} refunded`);
        }
        break;
      }

      default:
        console.log(`[billing/webhook] Unhandled event type: ${payload.event}`);
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
