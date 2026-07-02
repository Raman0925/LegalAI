import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock billing dependencies before importing service
vi.mock('#domains/billing/billing.service.js', () => ({
  startTrial: vi.fn().mockResolvedValue({
    id: 'sub-1',
    firmId: 'firm-1',
    status: 'trial',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  }),
}));

vi.mock('#domains/billing/billing.repository.js', () => ({
  getSubscriptionByFirm: vi.fn(),
}));

vi.mock('#domains/billing/billing.limits.js', () => ({
  checkSeatLimit: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock('#utils/email/resend.js', () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('#config/index.js', () => ({
  config: {
    jwtSecret: 'test-secret-key-for-testing',
    frontendUrl: 'http://localhost:3001',
    resendApiKey: 'test-key',
  },
}));

import { generateSlug, createFirmAndOnboard, joinFirm } from './onboarding.service.js';

// ─── generateSlug ─────────────────────────────────────────────────────────────

describe('generateSlug', () => {
  it('converts firm name to lowercase kebab-case', () => {
    const slug = generateSlug('Sharma & Associates');
    expect(slug).toMatch(/^sharma-associates-[a-z0-9]{4}$/);
  });

  it('handles special characters', () => {
    const slug = generateSlug('Legal AI! #1');
    expect(slug).toMatch(/^legal-ai-1-[a-z0-9]{4}$/);
  });

  it('truncates very long names to 40 chars base', () => {
    const longName = 'A'.repeat(100);
    const slug = generateSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(45); // 40 base + dash + 4 suffix
  });

  it('generates unique slugs for same name', () => {
    const slug1 = generateSlug('Same Firm');
    const slug2 = generateSlug('Same Firm');
    expect(slug1).not.toBe(slug2);
  });
});

// ─── createFirmAndOnboard ─────────────────────────────────────────────────────

describe('createFirmAndOnboard', () => {
  it('throws if user already has a firm', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { firm_id: 'existing-firm-id' },
              error: null,
            }),
          }),
        }),
      }),
    } as never;

    await expect(
      createFirmAndOnboard(mockSupabase, 'user-1', 'New Firm')
    ).rejects.toThrow('User already belongs to a firm');
  });
});

// ─── joinFirm ─────────────────────────────────────────────────────────────────

describe('joinFirm', () => {
  it('throws on invalid JWT token', async () => {
    const mockSupabase = {} as never;

    await expect(
      joinFirm(mockSupabase, 'user-1', 'user@test.com', 'invalid-token')
    ).rejects.toThrow('Invite link is invalid or has expired');
  });

  it('throws when email does not match token email', async () => {
    const jwt = await import('jsonwebtoken');

    const token = jwt.default.sign(
      { firmId: 'firm-1', email: 'invited@firm.com', type: 'invite' },
      'test-secret-key-for-testing',
      { expiresIn: '7d' }
    );

    const mockSupabase = {} as never;

    await expect(
      joinFirm(mockSupabase, 'user-1', 'different@email.com', token)
    ).rejects.toThrow('This invite was sent to a different email address');
  });
});
