-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 009: Firms, Profiles Update, Invites
-- Run in Supabase SQL Editor in exact order.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. firms table ──────────────────────────────────────────────────────────
-- Core tenant table. One row per law firm.
CREATE TABLE IF NOT EXISTS firms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE,           -- url-safe name e.g. "sharma-associates"
  owner_id    UUID,                         -- set after profile is created
  plan_name   TEXT        NOT NULL DEFAULT 'starter',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Add firm_id + role to profiles ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firm_id  UUID REFERENCES firms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role     TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member'));

-- Index for fast firm member lookups
CREATE INDEX IF NOT EXISTS idx_profiles_firm ON public.profiles(firm_id);

-- ─── Add firm_id to documents and matters ───────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id) ON DELETE SET NULL;

ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_firm ON public.documents(firm_id);
CREATE INDEX IF NOT EXISTS idx_matters_firm ON public.matters(firm_id);

-- ─── 3. firm_invites table ───────────────────────────────────────────────────
-- Tracks pending invitations sent to team members.
-- token is a signed JWT with firm_id + invited email.
CREATE TABLE IF NOT EXISTS firm_invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID        NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  token        TEXT        NOT NULL UNIQUE,
  invited_by   UUID        NOT NULL REFERENCES public.profiles(id),
  accepted     BOOLEAN     NOT NULL DEFAULT false,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_firm  ON firm_invites(firm_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON firm_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON firm_invites(email);

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE firms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_invites ENABLE ROW LEVEL SECURITY;

-- Firms: members can read their own firm
CREATE POLICY "firm_read_own" ON firms
  FOR SELECT USING (
    id IN (
      SELECT firm_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Invites: firm admins can read their firm's invites
CREATE POLICY "invite_read_own_firm" ON firm_invites
  FOR SELECT USING (
    firm_id IN (
      SELECT firm_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- ─── 5. Seat Limit Trigger for Race Condition Defense ───────────────────────
CREATE OR REPLACE FUNCTION check_firm_seat_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_max_seats INT;
  v_current_seats INT;
BEGIN
  -- If joining or changing firm
  IF NEW.firm_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.firm_id IS NULL OR NEW.firm_id <> OLD.firm_id) THEN
    -- Lock the parent firm row to serialize seat check operations for this tenant
    PERFORM 1 FROM public.firms WHERE id = NEW.firm_id FOR UPDATE;

    -- Get max seats limit from subscription
    SELECT sp.max_seats INTO v_max_seats
    FROM public.firm_subscriptions fs
    JOIN public.subscription_plans sp ON fs.plan_id = sp.id
    WHERE fs.firm_id = NEW.firm_id;

    -- If no subscription found, assume Starter/default limit of 3
    IF v_max_seats IS NULL THEN
      v_max_seats := 3;
    END IF;

    -- Count active profiles belonging to this firm (excluding the one joining/being updated)
    SELECT COUNT(*) INTO v_current_seats
    FROM public.profiles
    WHERE firm_id = NEW.firm_id AND id <> NEW.id;

    -- If adding this user would exceed max seats, reject
    IF v_current_seats + 1 > v_max_seats THEN
      RAISE EXCEPTION 'Firm seat limit of % reached', v_max_seats;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_check_firm_seat_limit ON public.profiles;
CREATE TRIGGER trg_check_firm_seat_limit
  BEFORE INSERT OR UPDATE OF firm_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_firm_seat_limit();

-- ─── 6. Secure Profiles SELECT Policy ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_auth_user_firm_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT firm_id FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by self and firm members" ON public.profiles;
CREATE POLICY "Profiles viewable by self and firm members" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (firm_id IS NOT NULL AND firm_id = public.get_auth_user_firm_id())
  );

-- ─── 7. Foreign Keys for Contracts & Editor Tables ─────────────────────────
ALTER TABLE public.contracts
  ADD CONSTRAINT fk_contracts_firm FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;

ALTER TABLE public.legal_documents
  ADD CONSTRAINT fk_legal_documents_firm FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;

ALTER TABLE public.document_versions
  ADD CONSTRAINT fk_document_versions_firm FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;

-- ─── 8. Replace GUC-based RLS Policies with Session-based Policies ──────────
-- Contracts
DROP POLICY IF EXISTS "firm_isolation_contracts" ON public.contracts;
CREATE POLICY "firm_isolation_contracts" ON public.contracts
  USING (firm_id = public.get_auth_user_firm_id());

-- Contract Pages
DROP POLICY IF EXISTS "firm_isolation_pages" ON public.contract_pages;
CREATE POLICY "firm_isolation_pages" ON public.contract_pages
  USING (firm_id = public.get_auth_user_firm_id());

-- Contract Annotations
DROP POLICY IF EXISTS "firm_isolation_annotations" ON public.contract_annotations;
CREATE POLICY "firm_isolation_annotations" ON public.contract_annotations
  USING (firm_id = public.get_auth_user_firm_id());

-- Legal Documents (Editor)
DROP POLICY IF EXISTS "firm_isolation_docs" ON public.legal_documents;
CREATE POLICY "firm_isolation_docs" ON public.legal_documents
  USING (firm_id = public.get_auth_user_firm_id());

-- Document Versions (Editor)
DROP POLICY IF EXISTS "firm_isolation_versions" ON public.document_versions;
CREATE POLICY "firm_isolation_versions" ON public.document_versions
  USING (firm_id = public.get_auth_user_firm_id());

-- Subscriptions (Billing)
DROP POLICY IF EXISTS "firm_isolation_subs" ON public.firm_subscriptions;
CREATE POLICY "firm_isolation_subs" ON public.firm_subscriptions
  USING (firm_id = public.get_auth_user_firm_id());

-- Usage Records (Billing)
DROP POLICY IF EXISTS "firm_isolation_usage" ON public.usage_records;
CREATE POLICY "firm_isolation_usage" ON public.usage_records
  USING (firm_id = public.get_auth_user_firm_id());

-- ─── 9. Scoping Matters & Related Tables by Firm ID ─────────────────────────
DROP POLICY IF EXISTS "Users manage own matters" ON public.matters;
DROP POLICY IF EXISTS "Firm level isolation on matters" ON public.matters;
CREATE POLICY "Firm level isolation on matters" ON public.matters
  FOR ALL USING (firm_id = public.get_auth_user_firm_id());

DROP POLICY IF EXISTS "Users manage own matter_documents" ON public.matter_documents;
DROP POLICY IF EXISTS "Firm level isolation on matter_documents" ON public.matter_documents;
CREATE POLICY "Firm level isolation on matter_documents" ON public.matter_documents
  FOR ALL USING (matter_id IN (SELECT id FROM public.matters WHERE firm_id = public.get_auth_user_firm_id()));

DROP POLICY IF EXISTS "Users manage own matter_clauses" ON public.matter_clauses;
DROP POLICY IF EXISTS "Firm level isolation on matter_clauses" ON public.matter_clauses;
CREATE POLICY "Firm level isolation on matter_clauses" ON public.matter_clauses
  FOR ALL USING (matter_id IN (SELECT id FROM public.matters WHERE firm_id = public.get_auth_user_firm_id()));

DROP POLICY IF EXISTS "Users manage own matter_drafts" ON public.matter_drafts;
DROP POLICY IF EXISTS "Firm level isolation on matter_drafts" ON public.matter_drafts;
CREATE POLICY "Firm level isolation on matter_drafts" ON public.matter_drafts
  FOR ALL USING (matter_id IN (SELECT id FROM public.matters WHERE firm_id = public.get_auth_user_firm_id()));


