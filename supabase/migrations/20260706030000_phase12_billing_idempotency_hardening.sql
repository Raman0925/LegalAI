-- migration: 20260706030000_phase12_billing_idempotency_hardening.sql
-- Hardens usage_records idempotency key by making it NOT NULL.
-- Pre-fills any existing NULL values using their row ID to prevent migration failure.

UPDATE usage_records SET idempotency_key = id::text WHERE idempotency_key IS NULL;

ALTER TABLE usage_records ALTER COLUMN idempotency_key SET NOT NULL;
