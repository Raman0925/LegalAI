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
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  gracePeriodEnd: Date | null;
  seatCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'cancelled'
  | 'halted'
  | 'pending';

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

// ─── Payment types ───────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'creating'
  | 'created'
  | 'attempted'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'expired';

export interface Payment {
  id: string;
  firmId: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  idempotencyKey: string;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentEvent {
  id: string;
  paymentId: string | null;
  firmId: string;
  razorpayEventId: string | null;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  amountPaise: number | null;
  rawPayload: Record<string, unknown> | null;
  errorCode: string | null;
  errorDescription: string | null;
  processedAt: Date;
}

export interface Invoice {
  id: string;
  firmId: string;
  subscriptionId: string | null;
  paymentId: string | null;
  invoiceNumber: string;
  status: 'draft' | 'issued' | 'paid' | 'void';
  amountPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: string;
  gstinSupplier: string | null;
  gstinRecipient: string | null;
  hsnSacCode: string | null;
  igstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  pdfUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Razorpay webhook event types we handle ──────────────────────────────────

export type RazorpayEventType =
  | 'subscription.activated'
  | 'subscription.charged'
  | 'subscription.halted'
  | 'subscription.cancelled'
  | 'subscription.completed'
  | 'payment.captured'
  | 'payment.failed'
  | 'refund.created';

// ─── Order creation response ─────────────────────────────────────────────────

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}
