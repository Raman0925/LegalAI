import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from './billing.service.js';
import crypto from 'crypto';

// Override config for tests — actual keys not needed
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_for_unit_tests';

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
