import { SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import * as repo from './onboarding.repository.js';
import { startTrial } from '#domains/billing/billing.service.js';
import { getSubscriptionByFirm } from '#domains/billing/billing.repository.js';
import { checkSeatLimit } from '#domains/billing/billing.limits.js';
import { sendInviteEmail } from '#utils/email/resend.js';
import { config } from '#config/index.js';
import type { OnboardingResult, InviteResult, JoinResult } from './onboarding.types.js';

/**
 * Generate a URL-safe slug from a firm name.
 * "Sharma & Associates" → "sharma-associates"
 * Appends a short random suffix to avoid collisions.
 */
export function generateSlug(firmName: string): string {
  const base = firmName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

/**
 * Create a new firm, link the user as owner, start 14-day trial.
 * Called once per firm — subsequent users join via invite.
 *
 * Throws if user already has a firm (must not call twice).
 */
export async function createFirmAndOnboard(
  supabase: SupabaseClient,
  userId: string,
  firmName: string
): Promise<OnboardingResult> {

  // Guard: check user doesn't already belong to a firm
  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id')
    .eq('id', userId)
    .single();

  if (profile?.firm_id) {
    throw new Error('User already belongs to a firm');
  }

  // Create firm
  const slug = generateSlug(firmName);
  const firm = await repo.createFirm(supabase, {
    name: firmName,
    slug,
    ownerId: userId,
  });

  // Link user as owner
  await repo.setProfileFirm(supabase, userId, firm.id, 'owner');

  // Start billing trial (Starter plan, 14 days)
  const subscription = await startTrial(supabase, firm.id);

  return {
    firm,
    profile: { id: userId, firmId: firm.id, role: 'owner' },
    subscription: {
      status: 'trial',
      trialEndsAt: subscription.trialEndsAt!,
    },
  };
}

/**
 * Send an invite email to a new team member.
 * Checks seat limits before sending — won't send if firm is full.
 * Token expires in 7 days.
 */
export async function inviteMember(
  supabase: SupabaseClient,
  firmId: string,
  invitedByUserId: string,
  email: string
): Promise<InviteResult> {

  // Get subscription + check seat limit
  const subscription = await getSubscriptionByFirm(supabase, firmId);
  if (!subscription) throw new Error('No active subscription');

  const currentSeats = await repo.getSeatCount(supabase, firmId);
  const seatCheck = checkSeatLimit(subscription.plan, currentSeats, 1);

  if (!seatCheck.allowed) {
    throw new Error(seatCheck.reason ?? 'Seat limit reached');
  }

  // Get firm details for email
  const firm = await repo.getFirmById(supabase, firmId);
  if (!firm) throw new Error('Firm not found');

  // Generate signed invite token — expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = jwt.sign(
    { firmId, email, type: 'invite' },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  // Persist invite
  await repo.createInvite(supabase, {
    firmId,
    email,
    token,
    invitedBy: invitedByUserId,
    expiresAt,
  });

  // Send email via Resend
  const inviteUrl = `${config.frontendUrl}/join?token=${token}`;
  await sendInviteEmail({ to: email, firmName: firm.name, inviteUrl });

  return { invited: true, email, expiresAt };
}

/**
 * Accept an invite and join a firm.
 * Verifies: token is valid JWT, email matches logged-in user,
 * invite not expired, invite not already accepted, seat still available.
 */
export async function joinFirm(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
  token: string
): Promise<JoinResult> {

  // Verify JWT signature and expiry
  let decoded: { firmId: string; email: string; type: string };
  try {
    decoded = jwt.verify(token, config.jwtSecret) as typeof decoded;
  } catch {
    throw new Error('Invite link is invalid or has expired');
  }

  if (decoded.type !== 'invite') {
    throw new Error('Invalid invite token type');
  }

  // Verify email matches — prevent token sharing
  if (decoded.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error('This invite was sent to a different email address');
  }

  // Check invite record in DB
  const invite = await repo.getInviteByToken(supabase, token);
  if (!invite) throw new Error('Invite not found or already used');

  // Get firm name for response
  const firm = await repo.getFirmById(supabase, invite.firmId);
  if (!firm) throw new Error('Firm not found');

  // Link user and mark invite accepted in an atomic database transaction
  const { error } = await supabase.rpc('join_firm_transactional', {
    p_user_id: userId,
    p_invite_id: invite.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { joined: true, firmId: invite.firmId, firmName: firm.name };
}
