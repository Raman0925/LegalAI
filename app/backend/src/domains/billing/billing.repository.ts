import { SupabaseClient } from '@supabase/supabase-js';
import {
  SubscriptionPlan,
  FirmSubscription,
  UsageMetric,
  UsageSummary,
  Payment,
  PaymentEvent,
  Invoice,
} from './billing.types.js';

// ─── Plans ─────────────────────────────────────────────────────

export async function getAllPlans(supabase: SupabaseClient): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_inr', { ascending: true });

  if (error) throw new Error('Failed to fetch plans');
  return (data ?? []).map(mapPlan);
}

export async function getPlanByName(
  supabase: SupabaseClient,
  name: string
): Promise<SubscriptionPlan | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('name', name)
    .single();

  if (error) return null;
  return mapPlan(data);
}

// ─── Subscriptions ──────────────────────────────────────────────

export async function getSubscriptionByFirm(
  supabase: SupabaseClient,
  firmId: string
): Promise<FirmSubscription | null> {
  const { data, error } = await supabase
    .from('firm_subscriptions')
    .select(`*, subscription_plans(*)`)
    .eq('firm_id', firmId)
    .single();

  if (error) return null;
  return mapSubscription(data);
}

export async function getSubscriptionByRazorpayId(
  supabase: SupabaseClient,
  razorpaySubscriptionId: string
): Promise<FirmSubscription | null> {
  const { data, error } = await supabase
    .from('firm_subscriptions')
    .select(`*, subscription_plans(*)`)
    .eq('razorpay_subscription_id', razorpaySubscriptionId)
    .single();

  if (error) return null;
  return mapSubscription(data);
}

export async function createSubscription(
  supabase: SupabaseClient,
  data: {
    firmId: string;
    planId: string;
    razorpaySubscriptionId?: string;
    razorpayCustomerId?: string;
    status: FirmSubscription['status'];
    trialEndsAt?: Date;
  }
): Promise<FirmSubscription> {
  const { data: sub, error } = await supabase
    .from('firm_subscriptions')
    .insert({
      firm_id: data.firmId,
      plan_id: data.planId,
      razorpay_subscription_id: data.razorpaySubscriptionId ?? null,
      razorpay_customer_id: data.razorpayCustomerId ?? null,
      status: data.status,
      trial_ends_at: data.trialEndsAt?.toISOString() ?? null,
    })
    .select(`*, subscription_plans(*)`)
    .single();

  if (error) throw new Error(`Failed to create subscription: ${error.message}`);
  return mapSubscription(sub);
}

export async function updateSubscriptionStatus(
  supabase: SupabaseClient,
  firmId: string,
  update: {
    status?: FirmSubscription['status'];
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    razorpaySubscriptionId?: string;
    razorpayCustomerId?: string;
    gracePeriodEnd?: Date | null;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (update.status) payload.status = update.status;
  if (update.currentPeriodStart) payload.current_period_start = update.currentPeriodStart.toISOString();
  if (update.currentPeriodEnd) payload.current_period_end = update.currentPeriodEnd.toISOString();
  if (update.razorpaySubscriptionId) payload.razorpay_subscription_id = update.razorpaySubscriptionId;
  if (update.razorpayCustomerId) payload.razorpay_customer_id = update.razorpayCustomerId;
  if (update.gracePeriodEnd !== undefined) {
    payload.grace_period_end = update.gracePeriodEnd?.toISOString() ?? null;
  }

  const { error } = await supabase
    .from('firm_subscriptions')
    .update(payload)
    .eq('firm_id', firmId);

  if (error) throw new Error(`Failed to update subscription: ${error.message}`);
}

/**
 * Upsert subscription for a firm — idempotent activation.
 * Used by both verifyPayment and webhook handler as a safety net.
 * ON CONFLICT on firm_id updates the plan + period instead of erroring.
 */
export async function upsertSubscription(
  supabase: SupabaseClient,
  data: {
    firmId: string;
    planName: string;
    amountPaise: number;
    periodStart: Date;
    periodEnd: Date;
  }
): Promise<void> {
  const plan = await getPlanByName(supabase, data.planName);
  if (!plan) throw new Error(`Plan not found: ${data.planName}`);

  // Check if subscription already exists for this firm
  const existing = await getSubscriptionByFirm(supabase, data.firmId);

  if (existing) {
    await updateSubscriptionStatus(supabase, data.firmId, {
      status: 'active',
      currentPeriodStart: data.periodStart,
      currentPeriodEnd: data.periodEnd,
      gracePeriodEnd: null,
    });

    // Also update the plan if it changed
    if (existing.planId !== plan.id) {
      const { error } = await supabase
        .from('firm_subscriptions')
        .update({
          plan_id: plan.id,
          updated_at: new Date().toISOString(),
        })
        .eq('firm_id', data.firmId);
      if (error) throw new Error(`Failed to update subscription plan: ${error.message}`);
    }
  } else {
    await createSubscription(supabase, {
      firmId: data.firmId,
      planId: plan.id,
      status: 'active',
    });
    await updateSubscriptionStatus(supabase, data.firmId, {
      status: 'active',
      currentPeriodStart: data.periodStart,
      currentPeriodEnd: data.periodEnd,
    });
  }
}

// ─── Usage ─────────────────────────────────────────────────────

export async function trackUsage(
  supabase: SupabaseClient,
  firmId: string,
  metric: UsageMetric,
  quantity = 1,
  idempotencyKey?: string
): Promise<string | null> {
  const key = idempotencyKey || `${firmId}_${metric}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  // INSERT only — never UPDATE usage rows (audit trail)
  const { data, error } = await supabase
    .from('usage_records')
    .insert({
      firm_id: firmId,
      usage_date: new Date().toISOString().slice(0, 10),
      metric,
      quantity,
      idempotency_key: key,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Usage tracking failed (non-fatal):', error.message);
    return null;
  }
  return data?.id || null;
}

export async function deleteUsageRecord(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('usage_records')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Failed to delete usage record ${id}:`, error.message);
  }
}

export async function getDailyUsage(
  supabase: SupabaseClient,
  firmId: string,
  metric: UsageMetric,
  date?: string
): Promise<number> {
  const usageDate = date ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('daily_usage')
    .select('total')
    .eq('firm_id', firmId)
    .eq('metric', metric)
    .eq('usage_date', usageDate)
    .single();

  if (error) return 0;
  return (data?.total as number) ?? 0;
}

export async function getUsageSummary(
  supabase: SupabaseClient,
  firmId: string,
  plan: SubscriptionPlan,
  seatCount: number
): Promise<UsageSummary> {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all metrics in parallel
  const [aiCallsToday, documentsTotal, storageBytes] = await Promise.all([
    getDailyUsage(supabase, firmId, 'ai_calls', today),
    getTotalUsageForFirm(supabase, firmId, 'documents_created'),
    getTotalUsageForFirm(supabase, firmId, 'storage_bytes'),
  ]);

  return {
    aiCallsToday,
    aiCallsLimit: plan.maxAiCallsDay,
    aiCallsPercent: Math.round((aiCallsToday / plan.maxAiCallsDay) * 100) || 0,
    documentsTotal,
    documentsLimit: plan.maxDocuments,
    seatsUsed: seatCount,
    seatsLimit: plan.maxSeats,
    storageUsedGb: Math.round(storageBytes / (1024 ** 3) * 10) / 10 || 0,
    storageLimit: plan.maxStorageGb,
  };
}

/**
 * Sum of all usage_records for a firm+metric (lifetime — not scoped to a day).
 * Used for cumulative limits like documents_created and storage_bytes.
 */
export async function getTotalUsageForFirm(
  supabase: SupabaseClient,
  firmId: string,
  metric: UsageMetric
): Promise<number> {
  const { data, error } = await supabase
    .from('usage_records')
    .select('quantity')
    .eq('firm_id', firmId)
    .eq('metric', metric);

  if (error) return 0;
  return (data ?? []).reduce((sum, r) => sum + (r.quantity as number), 0);
}

// ─── Webhook Events ─────────────────────────────────────────────

export async function saveWebhookEvent(
  supabase: SupabaseClient,
  data: { eventId: string; eventType: string; payload: Record<string, unknown> }
): Promise<boolean> {
  const { error } = await supabase.from('webhook_events').insert({
    event_id: data.eventId,
    event_type: data.eventType,
    payload: data.payload,
  });

  // If error is duplicate key, event already processed — skip
  if (error?.code === '23505') return false;   // unique violation
  if (error) throw new Error(`Failed to save webhook event: ${error.message}`);
  return true;
}

export async function markWebhookProcessed(
  supabase: SupabaseClient,
  eventId: string,
  error?: string
): Promise<void> {
  await supabase
    .from('webhook_events')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      error: error ?? null,
    })
    .eq('event_id', eventId);
}

// ─── Payments (order-level) ──────────────────────────────────────

/**
 * Insert a new payment row. Returns the row ID if inserted,
 * or null if a row with the same idempotency_key already exists.
 */
export async function createPaymentRecord(
  supabase: SupabaseClient,
  data: {
    firmId: string;
    amountPaise: number;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
  }
): Promise<string | null> {
  // Supabase doesn't support ON CONFLICT DO NOTHING natively on .insert(),
  // so we check first then insert. The DB UNIQUE constraint is the final guard.
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('idempotency_key', data.idempotencyKey)
    .maybeSingle();

  if (existing) return null;

  const { data: row, error } = await supabase
    .from('payments')
    .insert({
      firm_id: data.firmId,
      amount_paise: data.amountPaise,
      currency: 'INR',
      status: 'creating',
      idempotency_key: data.idempotencyKey,
      metadata: data.metadata,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  // Handle race condition — another request inserted between our check and insert
  if (error?.code === '23505') return null; // unique violation
  if (error) throw new Error(`Failed to create payment record: ${error.message}`);
  return row.id;
}

export async function getPaymentByIdempotencyKey(
  supabase: SupabaseClient,
  idempotencyKey: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error || !data) return null;
  return mapPayment(data);
}

export async function getPaymentByOrderId(
  supabase: SupabaseClient,
  razorpayOrderId: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle();

  if (error || !data) return null;
  return mapPayment(data);
}

export async function updatePaymentStatus(
  supabase: SupabaseClient,
  paymentId: string,
  update: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    status?: string;
    paymentMethod?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (update.razorpayOrderId) payload.razorpay_order_id = update.razorpayOrderId;
  if (update.razorpayPaymentId) payload.razorpay_payment_id = update.razorpayPaymentId;
  if (update.status) payload.status = update.status;
  if (update.paymentMethod) payload.payment_method = update.paymentMethod;
  if (update.metadata) payload.metadata = update.metadata;

  const { error } = await supabase
    .from('payments')
    .update(payload)
    .eq('id', paymentId);

  if (error) throw new Error(`Failed to update payment: ${error.message}`);
}

export async function getPaymentHistory(
  supabase: SupabaseClient,
  firmId: string,
  limit = 50
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error('Failed to fetch payment history');
  return (data ?? []).map(mapPayment);
}

// ─── Payment Events (audit log) ──────────────────────────────────

export async function createPaymentEvent(
  supabase: SupabaseClient,
  data: {
    paymentId?: string;
    firmId: string;
    razorpayEventId?: string;
    eventType: string;
    fromStatus?: string;
    toStatus?: string;
    amountPaise?: number;
    rawPayload?: Record<string, unknown>;
    errorCode?: string;
    errorDescription?: string;
  }
): Promise<void> {
  const { error } = await supabase.from('payment_events').insert({
    payment_id: data.paymentId ?? null,
    firm_id: data.firmId,
    razorpay_event_id: data.razorpayEventId ?? null,
    event_type: data.eventType,
    from_status: data.fromStatus ?? null,
    to_status: data.toStatus ?? null,
    amount_paise: data.amountPaise ?? null,
    raw_payload: data.rawPayload ?? null,
    error_code: data.errorCode ?? null,
    error_description: data.errorDescription ?? null,
  });

  // Duplicate event ID is OK — silently skip
  if (error?.code === '23505') return;
  if (error) {
    console.error('Failed to create payment event (non-fatal):', error.message);
  }
}

export async function checkPaymentEventExists(
  supabase: SupabaseClient,
  razorpayEventId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('payment_events')
    .select('id')
    .eq('razorpay_event_id', razorpayEventId)
    .maybeSingle();

  return !!data;
}

// ─── Invoices ─────────────────────────────────────────────────────

export async function createInvoice(
  supabase: SupabaseClient,
  data: {
    firmId: string;
    subscriptionId?: string;
    paymentId?: string;
    invoiceNumber: string;
    amountPaise: number;
    taxPaise: number;
    totalPaise: number;
    gstinSupplier?: string;
    gstinRecipient?: string;
    billingPeriodStart?: Date;
    billingPeriodEnd?: Date;
    igstPaise?: number;
    cgstPaise?: number;
    sgstPaise?: number;
  }
): Promise<Invoice> {
  const { data: row, error } = await supabase
    .from('invoices')
    .insert({
      firm_id: data.firmId,
      subscription_id: data.subscriptionId ?? null,
      payment_id: data.paymentId ?? null,
      invoice_number: data.invoiceNumber,
      status: 'issued',
      amount_paise: data.amountPaise,
      tax_paise: data.taxPaise,
      total_paise: data.totalPaise,
      currency: 'INR',
      gstin_supplier: data.gstinSupplier ?? null,
      gstin_recipient: data.gstinRecipient ?? null,
      igst_paise: data.igstPaise ?? 0,
      cgst_paise: data.cgstPaise ?? 0,
      sgst_paise: data.sgstPaise ?? 0,
      billing_period_start: data.billingPeriodStart?.toISOString() ?? null,
      billing_period_end: data.billingPeriodEnd?.toISOString() ?? null,
      issued_at: new Date().toISOString(),
      due_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create invoice: ${error.message}`);
  return mapInvoice(row);
}

export async function getInvoicesByFirm(
  supabase: SupabaseClient,
  firmId: string,
  limit = 12
): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map(mapInvoice);
}

// ─── Mappers ───────────────────────────────────────────────────

function mapPlan(row: Record<string, any>): SubscriptionPlan {
  return {
    id: row.id as string,
    name: row.name as SubscriptionPlan['name'],
    displayName: row.display_name as string,
    priceInr: row.price_inr as number,
    razorpayPlanId: row.razorpay_plan_id as string | null,
    maxSeats: row.max_seats as number,
    maxDocuments: row.max_documents as number | null,
    maxAiCallsDay: row.max_ai_calls_day as number,
    maxStorageGb: row.max_storage_gb as number,
    isActive: row.is_active as boolean,
  };
}

function mapSubscription(row: Record<string, any>): FirmSubscription {
  const plan = mapPlan(row.subscription_plans as Record<string, any>);
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    planId: row.plan_id as string,
    plan,
    razorpaySubscriptionId: row.razorpay_subscription_id as string | null,
    razorpayCustomerId: row.razorpay_customer_id as string | null,
    status: row.status as FirmSubscription['status'],
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at as string) : null,
    currentPeriodStart: row.current_period_start ? new Date(row.current_period_start as string) : null,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end as string) : null,
    gracePeriodEnd: row.grace_period_end ? new Date(row.grace_period_end as string) : null,
    seatCount: row.seat_count as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapPayment(row: Record<string, any>): Payment {
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    razorpayOrderId: row.razorpay_order_id as string | null,
    razorpayPaymentId: row.razorpay_payment_id as string | null,
    amountPaise: row.amount_paise as number,
    currency: row.currency as string,
    status: row.status,
    paymentMethod: row.payment_method as string | null,
    idempotencyKey: row.idempotency_key as string,
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapInvoice(row: Record<string, any>): Invoice {
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    subscriptionId: row.subscription_id as string | null,
    paymentId: row.payment_id as string | null,
    invoiceNumber: row.invoice_number as string,
    status: row.status,
    amountPaise: row.amount_paise as number,
    taxPaise: row.tax_paise as number,
    totalPaise: row.total_paise as number,
    currency: row.currency as string,
    gstinSupplier: row.gstin_supplier as string | null,
    gstinRecipient: row.gstin_recipient as string | null,
    hsnSacCode: row.hsn_sac_code as string | null,
    igstPaise: row.igst_paise as number,
    cgstPaise: row.cgst_paise as number,
    sgstPaise: row.sgst_paise as number,
    billingPeriodStart: row.billing_period_start ? new Date(row.billing_period_start as string) : null,
    billingPeriodEnd: row.billing_period_end ? new Date(row.billing_period_end as string) : null,
    issuedAt: row.issued_at ? new Date(row.issued_at as string) : null,
    dueAt: row.due_at ? new Date(row.due_at as string) : null,
    paidAt: row.paid_at ? new Date(row.paid_at as string) : null,
    pdfUrl: row.pdf_url as string | null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
