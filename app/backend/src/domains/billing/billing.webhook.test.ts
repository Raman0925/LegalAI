import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

// Override config for tests — actual keys not needed.
// Must be mocked (not just `process.env` set) since config/index.ts reads
// process.env at import time, which happens before any test file body runs.
vi.mock('#config/index.js', () => ({
  config: {
    razorpayKeyId: '',
    razorpayKeySecret: '',
    razorpayWebhookSecret: 'test_webhook_secret_for_unit_tests',
  },
}));

const { verifyWebhookSignature } = await import('./billing.service.js');

describe('verifyWebhookSignature', () => {
  const secret = 'test_webhook_secret_for_unit_tests';
  const body = JSON.stringify({ event: 'subscription.activated', created_at: 1700000000 });

  function makeSignature(payload: string, key: string): string {
    return crypto.createHmac('sha256', key).update(payload).digest('hex');
  }

  it('returns true for a valid signature', () => {
    const sig = makeSignature(body, secret);
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  it('returns false for a tampered body', () => {
    const sig = makeSignature(body, secret);
    const tamperedBody = body.replace('activated', 'cancelled');
    expect(verifyWebhookSignature(tamperedBody, sig)).toBe(false);
  });

  it('returns false for a wrong secret', () => {
    const sig = makeSignature(body, 'wrong_secret');
    expect(verifyWebhookSignature(body, sig)).toBe(false);
  });

  it('returns false for an empty signature', () => {
    expect(verifyWebhookSignature(body, '')).toBe(false);
  });
});

vi.mock('./billing.repository.js', () => ({
  saveWebhookEvent: vi.fn(),
  getSubscriptionByRazorpayId: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  markWebhookProcessed: vi.fn(),
}));

const { processWebhookEvent } = await import('./billing.webhook.js');
const repo = await import('./billing.repository.js');

describe('processWebhookEvent', () => {
  const mockSupabase = {} as any;

  it('skips processing if event is already saved (not new)', async () => {
    vi.mocked(repo.saveWebhookEvent).mockResolvedValueOnce(false); // already exists

    const payload = {
      event: 'subscription.activated',
      payload: {},
      created_at: 12345,
    } as any;

    await processWebhookEvent(mockSupabase, 'evt-1', payload);

    expect(repo.saveWebhookEvent).toHaveBeenCalledWith(mockSupabase, {
      eventId: 'evt-1',
      eventType: 'subscription.activated',
      payload,
    });
    expect(repo.getSubscriptionByRazorpayId).not.toHaveBeenCalled();
  });

  it('processes subscription.activated successfully', async () => {
    vi.mocked(repo.saveWebhookEvent).mockResolvedValueOnce(true); // new event
    vi.mocked(repo.getSubscriptionByRazorpayId).mockResolvedValueOnce({
      id: 'sub-1',
      firmId: 'firm-123',
      planId: 'plan-1',
      status: 'trial',
      seatCount: 1,
    } as any);

    const payload = {
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'razor-sub-id',
            customer_id: 'cust-id',
            current_start: 1700000000,
            current_end: 1700086400,
          },
        },
      },
      created_at: 1700000000,
    } as any;

    await processWebhookEvent(mockSupabase, 'evt-2', payload);

    expect(repo.getSubscriptionByRazorpayId).toHaveBeenCalledWith(mockSupabase, 'razor-sub-id');
    expect(repo.updateSubscriptionStatus).toHaveBeenCalledWith(mockSupabase, 'firm-123', {
      status: 'active',
      razorpayCustomerId: 'cust-id',
      currentPeriodStart: new Date(1700000000 * 1000),
      currentPeriodEnd: new Date(1700086400 * 1000),
    });
    expect(repo.markWebhookProcessed).toHaveBeenCalledWith(mockSupabase, 'evt-2');
  });
});

