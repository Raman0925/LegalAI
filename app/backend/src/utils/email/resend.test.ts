import { describe, it, expect, vi } from 'vitest';

// Mock Resend before importing the module
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

vi.mock('#config/index.js', () => ({
  config: { resendApiKey: 'test-key', frontendUrl: 'http://localhost:3001' },
}));

import { sendInviteEmail, sendUsageAlertEmail } from './resend.js';

describe('sendInviteEmail', () => {
  it('resolves without throwing even if Resend fails', async () => {
    // Should never throw — email failure is non-fatal
    await expect(sendInviteEmail({
      to: 'test@firm.com',
      firmName: 'Test Firm',
      inviteUrl: 'http://localhost:3001/join?token=abc',
    })).resolves.toBeUndefined();
  });
});

describe('sendUsageAlertEmail', () => {
  it('resolves without throwing', async () => {
    await expect(sendUsageAlertEmail({
      to: 'admin@firm.com',
      firmName: 'Test Firm',
      metric: 'AI calls',
      percentUsed: 82,
      upgradeUrl: 'http://localhost:3001/billing/plans',
    })).resolves.toBeUndefined();
  });
});
