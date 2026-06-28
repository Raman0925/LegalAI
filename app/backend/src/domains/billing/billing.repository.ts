import { SupabaseClient } from '@supabase/supabase-js';
import {
  SubscriptionPlan,
  FirmSubscription,
  UsageMetric,
  UsageSummary,
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

  const { error } = await supabase
    .from('firm_subscriptions')
    .update(payload)
    .eq('firm_id', firmId);

  if (error) throw new Error(`Failed to update subscription: ${error.message}`);
}

// ─── Usage ─────────────────────────────────────────────────────

export async function trackUsage(
  supabase: SupabaseClient,
  firmId: string,
  metric: UsageMetric,
  quantity = 1
): Promise<void> {
  // INSERT only — never UPDATE usage rows (audit trail)
  const { error } = await supabase.from('usage_records').insert({
    firm_id: firmId,
    usage_date: new Date().toISOString().slice(0, 10),
    metric,
    quantity,
  });

  if (error) console.error('Usage tracking failed (non-fatal):', error.message);
  // Non-fatal — don't throw, just log
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
    getTotalUsage(supabase, firmId, 'documents_created'),
    getTotalUsage(supabase, firmId, 'storage_bytes'),
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

async function getTotalUsage(
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
    seatCount: row.seat_count as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
