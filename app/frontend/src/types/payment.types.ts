// ─── Razorpay window type declaration ────────────────────────────────────────

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

// ─── Razorpay Checkout options ───────────────────────────────────────────────

export interface RazorpayOptions {
  key: string;
  amount: string;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  handler: (response: RazorpaySuccessResponse) => void;
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: any) => void) => void;
  close: () => void;
}

// ─── Razorpay response types ─────────────────────────────────────────────────

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailedResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  };
}

// ─── Payment state machine ──────────────────────────────────────────────────

export type PaymentState =
  | 'idle'
  | 'creating_order'
  | 'payment_open'
  | 'verifying'
  | 'success'
  | 'failed';

// ─── API response types ──────────────────────────────────────────────────────

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  subscriptionStatus: string;
}

export interface PaymentRecord {
  id: string;
  firmId: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  amountPaise: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  status: string;
  amountPaise: number;
  totalPaise: number;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
}

export interface BillingOverviewResponse {
  subscription: {
    id: string;
    status: string;
    trialEndsAt: string | null;
    gracePeriodEnd: string | null;
    plan: {
      displayName: string;
      priceInr: number;
      name: string;
    };
    currentPeriodEnd: string | null;
  } | null;
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
}
