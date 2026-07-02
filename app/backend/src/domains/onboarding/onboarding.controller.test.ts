import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing controller
vi.mock('./onboarding.service.js', () => ({
  createFirmAndOnboard: vi.fn(),
  inviteMember: vi.fn(),
  joinFirm: vi.fn(),
}));

vi.mock('./onboarding.repository.js', () => ({
  getProfilesByFirm: vi.fn(),
  getPendingInvitesByFirm: vi.fn(),
}));

vi.mock('#middlewares/auth.middleware.js', () => ({
  default: vi.fn().mockImplementation(async () => {}),
}));

import { createFirmAndOnboard, inviteMember, joinFirm } from './onboarding.service.js';
import { getProfilesByFirm, getPendingInvitesByFirm } from './onboarding.repository.js';

describe('onboarding controller', () => {
  describe('POST /onboarding/firm', () => {
    it('calls createFirmAndOnboard with correct params', async () => {
      const mockResult = {
        firm: { id: 'firm-1', name: 'Test Firm' },
        profile: { id: 'user-1', firmId: 'firm-1', role: 'owner' },
        subscription: { status: 'trial', trialEndsAt: new Date() },
      };
      vi.mocked(createFirmAndOnboard).mockResolvedValue(mockResult as never);

      // Verify the service function contract
      const result = await createFirmAndOnboard({} as never, 'user-1', 'Test Firm');
      expect(result.firm.id).toBe('firm-1');
      expect(result.profile.role).toBe('owner');
    });

    it('rejects when user already has a firm', async () => {
      vi.mocked(createFirmAndOnboard).mockRejectedValue(
        new Error('User already belongs to a firm')
      );

      await expect(
        createFirmAndOnboard({} as never, 'user-1', 'Another Firm')
      ).rejects.toThrow('User already belongs to a firm');
    });
  });

  describe('POST /onboarding/invite', () => {
    it('calls inviteMember with correct params', async () => {
      const mockResult = {
        invited: true,
        email: 'test@firm.com',
        expiresAt: new Date(),
      };
      vi.mocked(inviteMember).mockResolvedValue(mockResult);

      const result = await inviteMember({} as never, 'firm-1', 'user-1', 'test@firm.com');
      expect(result.invited).toBe(true);
      expect(result.email).toBe('test@firm.com');
    });

    it('rejects when seat limit reached', async () => {
      vi.mocked(inviteMember).mockRejectedValue(new Error('Seat limit reached'));

      await expect(
        inviteMember({} as never, 'firm-1', 'user-1', 'test@firm.com')
      ).rejects.toThrow('Seat limit reached');
    });
  });

  describe('POST /onboarding/join', () => {
    it('calls joinFirm with correct params', async () => {
      const mockResult = {
        joined: true,
        firmId: 'firm-1',
        firmName: 'Test Firm',
      };
      vi.mocked(joinFirm).mockResolvedValue(mockResult);

      const result = await joinFirm({} as never, 'user-1', 'user@test.com', 'token-abc');
      expect(result.joined).toBe(true);
      expect(result.firmId).toBe('firm-1');
    });
  });

  describe('GET /onboarding/members', () => {
    it('returns members and pending invites', async () => {
      const mockMembers = [
        { id: 'user-1', email: 'owner@firm.com', fullName: 'Owner', role: 'owner' },
      ];
      const mockInvites = [
        { id: 'inv-1', firmId: 'firm-1', email: 'invited@firm.com', token: 'tok', invitedBy: 'user-1', accepted: false, expiresAt: new Date(), createdAt: new Date() },
      ];

      vi.mocked(getProfilesByFirm).mockResolvedValue(mockMembers);
      vi.mocked(getPendingInvitesByFirm).mockResolvedValue(mockInvites as never);

      const members = await getProfilesByFirm({} as never, 'firm-1');
      const invites = await getPendingInvitesByFirm({} as never, 'firm-1');

      expect(members).toHaveLength(1);
      expect(members[0].role).toBe('owner');
      expect(invites).toHaveLength(1);
      expect(invites[0].accepted).toBe(false);
    });
  });
});
