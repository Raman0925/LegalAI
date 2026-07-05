-- migration: 20260706000000_phase9_billing_rls_hardening.sql
-- Enables RLS on webhook_events and subscription_plans (previously unprotected),
-- and adds sanity CHECK constraints to subscription_plans.

-- ─── 1. webhook_events — service-role only (raw Razorpay payloads) ──────────
-- No authenticated-user policy is created: with RLS enabled and zero policies,
-- authenticated/anon roles get zero rows. Only the service-role client (which
-- bypasses RLS) can read/write this table.

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ─── 2. subscription_plans — public read of active plans only ───────────────

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_public_read" ON subscription_plans;
CREATE POLICY "plans_public_read" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- ─── 3. Sanity CHECK constraints on subscription_plans ───────────────────────
-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS", so guard via pg_constraint.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'price_non_negative'
  ) THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT price_non_negative CHECK (price_inr >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'max_seats_positive'
  ) THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT max_seats_positive CHECK (max_seats > 0);
  END IF;
END $$;
