import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
import { requireActiveSubscription } from '#middlewares/subscription.middleware.js';
import {
  createFirmAndOnboard,
  inviteMember,
  joinFirm,
} from './onboarding.service.js';
import * as repo from './onboarding.repository.js';
import {
  CreateFirmSchema,
  InviteMemberSchema,
  JoinFirmSchema,
  createFirmJsonSchema,
  inviteMemberJsonSchema,
  joinFirmJsonSchema,
} from './onboarding.schema.js';

export async function onboardingController(app: FastifyInstance) {
  app.post('/firm', {
    preHandler: [authenticate],
    schema: createFirmJsonSchema,
  }, async (request, reply) => {
    const { id: userId } = request.user;
    const { firmName } = CreateFirmSchema.parse(request.body);

    try {
      const result = await createFirmAndOnboard(
        app.supabase,
        userId,
        firmName
      );
      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onboarding failed';
      request.log.error(err, 'Firm creation failed');
      return reply.status(400).send({ error: message });
    }
  });

  app.post('/invite', {
    preHandler: [authenticate, requireActiveSubscription],
    schema: inviteMemberJsonSchema,
  }, async (request, reply) => {
    const { id: userId, firmId, role } = request.user;

    if (!firmId) {
      return reply.status(400).send({ error: 'You must belong to a firm to invite members' });
    }

    // Only owners and admins can invite
    if (role !== 'owner' && role !== 'admin') {
      return reply.status(403).send({ error: 'Only firm owners and admins can invite members' });
    }

    const { email } = InviteMemberSchema.parse(request.body);

    try {
      const result = await inviteMember(app.supabase, firmId, userId, email);
      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invite failed';
      request.log.error(err, 'Member invite failed');
      return reply.status(400).send({ error: message });
    }
  });

  // ── POST /onboarding/join ─────────────────────────────────────────────────
  // Accepts an invite and links user to firm.
  // Called after Google OAuth when user lands on /join?token=xxx
  app.post('/join', {
    preHandler: [authenticate],
    schema: joinFirmJsonSchema,
  }, async (request, reply) => {
    const { id: userId, email } = request.user;
    const { token } = JoinFirmSchema.parse(request.body);

    try {
      const result = await joinFirm(app.supabase, userId, email, token);
      return reply.status(200).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not join firm';
      request.log.warn(err, 'Join firm failed');
      return reply.status(400).send({ error: message });
    }
  });

  // ── GET /onboarding/members ───────────────────────────────────────────────
  // Returns all members in the current firm + pending invites.
  // Used by the team management page.
  app.get('/members', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { firmId } = request.user;

    if (!firmId) {
      return reply.status(400).send({ error: 'No firm found' });
    }

    try {
      const [members, pendingInvites] = await Promise.all([
        repo.getProfilesByFirm(app.supabase, firmId),
        repo.getPendingInvitesByFirm(app.supabase, firmId),
      ]);

      return reply.send({ members, pendingInvites });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch members';
      request.log.error(err, 'Fetch members failed');
      return reply.status(500).send({ error: message });
    }
  });
}
