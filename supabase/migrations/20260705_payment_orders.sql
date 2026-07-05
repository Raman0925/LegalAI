-- migration: 20260705_payment_orders.sql
-- Adds: payments, payment_events, invoices tables for Razorpay Checkout flow

-- ─── 1. Payments table (order-level tracking) ────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  amount_paise        INTEGER NOT NULL CHECK (amount_paise > 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'creating'
                      CHECK (status IN (
                        'creating', 'created', 'attempted',
                        'captured', 'failed', 'refunded', 'expired'
                      )),
  payment_method      TEXT,
  idempotency_key     TEXT UNIQUE NOT NULL,
  expires_at          TIMESTAMPTZ,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_firm_id     ON payments(firm_id);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(firm_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at  ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_expires_at  ON payments(expires_at)
  WHERE status = 'created';

-- ─── 2. Payment events (append-only audit log) ──────────────────────────────

CREATE TABLE IF NOT EXISTS payment_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          UUID REFERENCES payments(id) ON DELETE SET NULL,
  firm_id             UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  razorpay_event_id   TEXT UNIQUE,
  event_type          TEXT NOT NULL CHECK (event_type != ''),
  from_status         TEXT,
  to_status           TEXT,
  amount_paise        INTEGER,
  raw_payload         JSONB,
  error_code          TEXT,
  error_description   TEXT,
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id     ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_firm_id        ON payment_events(firm_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_processed_at   ON payment_events(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_razorpay_event ON payment_events(razorpay_event_id)
  WHERE razorpay_event_id IS NOT NULL;

-- ─── 3. Invoices table (with GST support) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id               UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  subscription_id       UUID REFERENCES firm_subscriptions(id),
  payment_id            UUID REFERENCES payments(id),
  invoice_number        TEXT UNIQUE NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  amount_paise          INTEGER NOT NULL,
  tax_paise             INTEGER NOT NULL DEFAULT 0,
  total_paise           INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'INR',
  gstin_supplier        TEXT,
  gstin_recipient       TEXT,
  hsn_sac_code          TEXT DEFAULT '998314',
  igst_paise            INTEGER DEFAULT 0,
  cgst_paise            INTEGER DEFAULT 0,
  sgst_paise            INTEGER DEFAULT 0,
  billing_period_start  TIMESTAMPTZ,
  billing_period_end    TIMESTAMPTZ,
  issued_at             TIMESTAMPTZ,
  due_at                TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  pdf_url               TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_firm_id       ON invoices(firm_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON invoices(firm_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription  ON invoices(subscription_id);

-- ─── 4. Add grace_period_end to firm_subscriptions ───────────────────────────

ALTER TABLE firm_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ;

-- Update status CHECK to include grace_period
-- Drop and re-add the constraint to include 'grace_period'
ALTER TABLE firm_subscriptions DROP CONSTRAINT IF EXISTS firm_subscriptions_status_check;
ALTER TABLE firm_subscriptions ADD CONSTRAINT firm_subscriptions_status_check
  CHECK (status IN (
    'trial', 'active', 'past_due', 'grace_period',
    'cancelled', 'halted', 'pending'
  ));

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "firm_isolation_payments" ON payments;
CREATE POLICY "firm_isolation_payments" ON payments
  USING (firm_id = public.get_auth_user_firm_id());

DROP POLICY IF EXISTS "firm_isolation_payment_events" ON payment_events;
CREATE POLICY "firm_isolation_payment_events" ON payment_events
  USING (firm_id = public.get_auth_user_firm_id());

DROP POLICY IF EXISTS "firm_isolation_invoices" ON invoices;
CREATE POLICY "firm_isolation_invoices" ON invoices
  USING (firm_id = public.get_auth_user_firm_id());
