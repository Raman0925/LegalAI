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
