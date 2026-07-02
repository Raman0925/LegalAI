-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 002: Firms, Profiles Update, Invites
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. firms table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE,
  owner_id    UUID,
  plan_name   TEXT        NOT NULL DEFAULT 'starter',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Add firm_id + role to profiles ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firm_id  UUID REFERENCES firms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role     TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member'));

CREATE INDEX IF NOT EXISTS idx_profiles_firm ON public.profiles(firm_id);

-- ─── 3. firm_invites table ───────────────────────────────────────────────────
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

-- ─── 5. Helper Function for Session Firm ID ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_auth_user_firm_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT firm_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Firms: members can read their own firm
CREATE POLICY "firm_read_own" ON firms
  FOR SELECT USING (
    id = public.get_auth_user_firm_id()
  );

-- Invites: firm admins/owners can read their firm's invites
CREATE POLICY "invite_read_own_firm" ON firm_invites
  FOR SELECT USING (
    firm_id = public.get_auth_user_firm_id()
  );

-- Profiles: members can read profiles of the same firm
DROP POLICY IF EXISTS "Public profiles are viewable by self" ON public.profiles;
CREATE POLICY "Profiles viewable by self and firm members" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (firm_id IS NOT NULL AND firm_id = public.get_auth_user_firm_id())
  );

-- ─── 6. Transactional Join Firm RPC ──────────────────────────────────────────
-- Atomically checks requirements, locks firm/invite, assigns profile, and accepts invite.
CREATE OR REPLACE FUNCTION join_firm_transactional(p_user_id UUID, p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_firm_id UUID;
  v_email TEXT;
  v_user_email TEXT;
  v_expires_at TIMESTAMPTZ;
  v_accepted BOOLEAN;
BEGIN
  -- 1. Fetch and lock invite details
  SELECT firm_id, email, accepted, expires_at 
  INTO v_firm_id, v_email, v_accepted, v_expires_at
  FROM public.firm_invites
  WHERE id = p_invite_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_accepted THEN
    RAISE EXCEPTION 'This invite has already been used';
  END IF;

  IF now() > v_expires_at THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  -- 2. Fetch and check user email
  SELECT email INTO v_user_email
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_email IS NULL OR lower(v_user_email) <> lower(v_email) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  -- 3. Lock the firm row to serialize seat checks (trigger on profiles will count)
  PERFORM 1 FROM public.firms WHERE id = v_firm_id FOR UPDATE;

  -- 4. Update user profile to link to firm (will trigger check_firm_seat_limit)
  UPDATE public.profiles 
  SET firm_id = v_firm_id, role = 'member' 
  WHERE id = p_user_id;

  -- 5. Mark invite as accepted
  UPDATE public.firm_invites
  SET accepted = true
  WHERE id = p_invite_id;

  RETURN TRUE;
END;
$$;
