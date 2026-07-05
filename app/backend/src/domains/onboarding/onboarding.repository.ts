import { SupabaseClient } from '@supabase/supabase-js';
import { Firm, FirmInvite } from './onboarding.types.js';

// ─── Firms ────────────────────────────────────────────────────────────────────

export async function createFirm(
  supabase: SupabaseClient,
  data: { name: string; slug: string; ownerId: string }
): Promise<Firm> {
  const { data: firm, error } = await supabase
    .from('firms')
    .insert({
      name: data.name,
      slug: data.slug,
      owner_id: data.ownerId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create firm: ${error.message}`);
  return mapFirm(firm);
}

export async function getFirmById(
  supabase: SupabaseClient,
  firmId: string
): Promise<Firm | null> {
  const { data, error } = await supabase
    .from('firms')
    .select('*')
    .eq('id', firmId)
    .single();

  if (error) return null;
  return mapFirm(data);
}

export async function getFirmBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Firm | null> {
  const { data, error } = await supabase
    .from('firms')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) return null;
  return mapFirm(data);
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function setProfileFirm(
  supabase: SupabaseClient,
  userId: string,
  firmId: string,
  role: 'owner' | 'admin' | 'member'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ firm_id: firmId, role })
    .eq('id', userId);

  if (error) throw new Error(`Failed to update profile firm: ${error.message}`);
}

export async function getProfilesByFirm(
  supabase: SupabaseClient,
  firmId: string
): Promise<{ id: string; email: string; fullName: string | null; role: string }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: true });

  if (error) throw new Error('Failed to fetch firm members');
  return (data ?? []).map(r => ({
    id: r.id as string,
    email: r.email as string,
    fullName: r.full_name as string | null,
    role: r.role as string,
  }));
}

export async function getSeatCount(
  supabase: SupabaseClient,
  firmId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('firm_id', firmId);

  if (error) return 0;
  return count ?? 0;
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function createInvite(
  supabase: SupabaseClient,
  data: {
    firmId: string;
    email: string;
    token: string;
    invitedBy: string;
    expiresAt: Date;
  }
): Promise<FirmInvite> {
  const { data: invite, error } = await supabase
    .from('firm_invites')
    .insert({
      firm_id: data.firmId,
      email: data.email,
      token: data.token,
      invited_by: data.invitedBy,
      expires_at: data.expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create invite: ${error.message}`);
  return mapInvite(invite);
}

export async function getInviteByToken(
  supabase: SupabaseClient,
  token: string
): Promise<FirmInvite | null> {
  const { data, error } = await supabase
    .from('firm_invites')
    .select('*')
    .eq('token', token)
    .eq('accepted', false)
    .single();

  if (error) return null;
  return mapInvite(data);
}

export async function getPendingInviteByEmail(
  supabase: SupabaseClient,
  firmId: string,
  email: string
): Promise<FirmInvite | null> {
  const { data, error } = await supabase
    .from('firm_invites')
    .select('*')
    .eq('firm_id', firmId)
    .eq('email', email.toLowerCase())
    .eq('accepted', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return mapInvite(data);
}

export async function getPendingInvitesByFirm(
  supabase: SupabaseClient,
  firmId: string
): Promise<FirmInvite[]> {
  const { data, error } = await supabase
    .from('firm_invites')
    .select('*')
    .eq('firm_id', firmId)
    .eq('accepted', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error('Failed to fetch invites');
  return (data ?? []).map(mapInvite);
}

export async function markInviteAccepted(
  supabase: SupabaseClient,
  inviteId: string
): Promise<void> {
  const { error } = await supabase
    .from('firm_invites')
    .update({ accepted: true })
    .eq('id', inviteId);

  if (error) throw new Error('Failed to mark invite accepted');
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapFirm(row: Record<string, unknown>): Firm {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    ownerId: row.owner_id as string | null,
    planName: row.plan_name as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapInvite(row: Record<string, unknown>): FirmInvite {
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    email: row.email as string,
    token: row.token as string,
    invitedBy: row.invited_by as string,
    accepted: row.accepted as boolean,
    expiresAt: new Date(row.expires_at as string),
    createdAt: new Date(row.created_at as string),
  };
}
