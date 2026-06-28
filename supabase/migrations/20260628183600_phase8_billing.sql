-- migration: 20260628183600_phase8_billing.sql

CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,     -- 'starter', 'growth', 'pro', 'enterprise'
  display_name    TEXT NOT NULL,
  price_inr       INTEGER NOT NULL,         -- monthly price in paise (₹2999 = 299900)
  razorpay_plan_id TEXT,                    -- Razorpay plan ID
  max_seats       INTEGER NOT NULL,
  max_documents   INTEGER,                  -- NULL = unlimited
  max_ai_calls_day INTEGER NOT NULL,
  max_storage_gb  INTEGER NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firm_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id               UUID NOT NULL UNIQUE REFERENCES firms(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES subscription_plans(id),
  razorpay_subscription_id TEXT UNIQUE,
  razorpay_customer_id  TEXT,
  status                TEXT NOT NULL DEFAULT 'trial'
                          CHECK (status IN (
                            'trial', 'active', 'past_due',
                            'cancelled', 'halted', 'pending'
                          )),
  trial_ends_at         TIMESTAMPTZ,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  seat_count            INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  usage_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  metric        TEXT NOT NULL
                  CHECK (metric IN (
                    'ai_calls', 'documents_created',
                    'storage_bytes', 'research_sessions'
                  )),
  quantity      INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT NOT NULL UNIQUE,     -- Razorpay event ID — idempotency key
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT false,
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage aggregation view (sum by firm+date+metric)
CREATE OR REPLACE VIEW daily_usage AS
SELECT
  firm_id,
  usage_date,
  metric,
  SUM(quantity) AS total
FROM usage_records
GROUP BY firm_id, usage_date, metric;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_firm_subs_firm      ON firm_subscriptions(firm_id);
CREATE INDEX IF NOT EXISTS idx_firm_subs_status    ON firm_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_firm_date     ON usage_records(firm_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_metric        ON usage_records(metric);
CREATE INDEX IF NOT EXISTS idx_webhook_event_id    ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_processed   ON webhook_events(processed);

-- Seed plans (run after migration)
INSERT INTO subscription_plans
  (name, display_name, price_inr, max_seats, max_documents, max_ai_calls_day, max_storage_gb)
VALUES
  ('starter',    'Starter',    299900,  3,  50,        100,  5),
  ('growth',     'Growth',     799900,  10, 250,       500,  20),
  ('pro',        'Pro',        1999900, 25, NULL,      2000, 100),
  ('enterprise', 'Enterprise', 0,       999, NULL,     99999, 9999)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_inr = EXCLUDED.price_inr,
  max_seats = EXCLUDED.max_seats,
  max_documents = EXCLUDED.max_documents,
  max_ai_calls_day = EXCLUDED.max_ai_calls_day,
  max_storage_gb = EXCLUDED.max_storage_gb;

-- RLS
ALTER TABLE firm_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records       ENABLE ROW LEVEL SECURITY;

-- Scoped Policies
DROP POLICY IF EXISTS "firm_isolation_subs" ON firm_subscriptions;
CREATE POLICY "firm_isolation_subs" ON firm_subscriptions
  USING (firm_id = current_setting('app.current_firm_id', true)::UUID);

DROP POLICY IF EXISTS "firm_isolation_usage" ON usage_records;
CREATE POLICY "firm_isolation_usage" ON usage_records
  USING (firm_id = current_setting('app.current_firm_id', true)::UUID);
