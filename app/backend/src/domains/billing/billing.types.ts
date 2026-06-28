export interface SubscriptionPlan {
  id: string;
  name: 'starter' | 'growth' | 'pro' | 'enterprise';
  displayName: string;
  priceInr: number;          // in paise
  razorpayPlanId: string | null;
  maxSeats: number;
  maxDocuments: number | null;
  maxAiCallsDay: number;
  maxStorageGb: number;
  isActive: boolean;
}

export interface FirmSubscription {
  id: string;
  firmId: string;
  planId: string;
  plan: SubscriptionPlan;
  razorpaySubscriptionId: string | null;
  razorpayCustomerId: string | null;
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'halted' | 'pending';
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  seatCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageRecord {
  id: string;
  firmId: string;
  usageDate: string;         // YYYY-MM-DD
  metric: UsageMetric;
  quantity: number;
  createdAt: Date;
}

export type UsageMetric =
  | 'ai_calls'
  | 'documents_created'
  | 'storage_bytes'
  | 'research_sessions';

export interface DailyUsage {
  firmId: string;
  usageDate: string;
  metric: UsageMetric;
  total: number;
}

export interface UsageSummary {
  aiCallsToday: number;
  aiCallsLimit: number;
  aiCallsPercent: number;
  documentsTotal: number;
  documentsLimit: number | null;
  seatsUsed: number;
  seatsLimit: number;
  storageUsedGb: number;
  storageLimit: number;
}

export interface WebhookEvent {
  id: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

// Razorpay webhook event types we handle
export type RazorpayEventType =
  | 'subscription.activated'
  | 'subscription.charged'
  | 'subscription.halted'
  | 'subscription.cancelled'
  | 'subscription.completed'
  | 'payment.failed';
