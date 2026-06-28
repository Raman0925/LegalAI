import { describe, it, expect } from 'vitest';
import { checkLimit, checkSeatLimit, isSubscriptionActive } from './billing.limits.js';
import type { SubscriptionPlan } from './billing.types.js';

// ─── Test fixture ────────────────────────────────────────────────────────────

const starterPlan: SubscriptionPlan = {
  id: 'plan-uuid',
  name: 'starter',
  displayName: 'Starter',
  priceInr: 299900,
  razorpayPlanId: null,
  maxSeats: 3,
  maxDocuments: 50,
  maxAiCallsDay: 100,
  maxStorageGb: 5,
  isActive: true,
};

const proPlan: SubscriptionPlan = {
  ...starterPlan,
  name: 'pro',
  displayName: 'Pro',
  maxDocuments: null,   // unlimited
  maxAiCallsDay: 2000,
  maxSeats: 25,
};

// ─── checkLimit: ai_calls ────────────────────────────────────────────────────

describe('checkLimit — ai_calls', () => {
  it('allows when under daily limit', () => {
    const result = checkLimit(starterPlan, 'ai_calls', 50);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(50);
    expect(result.limit).toBe(100);
  });

  it('blocks when exactly at daily limit', () => {
    const result = checkLimit(starterPlan, 'ai_calls', 100);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/100\/100/);
  });

  it('blocks when over daily limit', () => {
    const result = checkLimit(starterPlan, 'ai_calls', 150);
    expect(result.allowed).toBe(false);
  });
});

// ─── checkLimit: documents_created ───────────────────────────────────────────

describe('checkLimit — documents_created', () => {
  it('allows when under document limit', () => {
    const result = checkLimit(starterPlan, 'documents_created', 49);
    expect(result.allowed).toBe(true);
  });

  it('blocks when at document limit', () => {
    const result = checkLimit(starterPlan, 'documents_created', 50);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/50\/50/);
  });

  it('always allows when maxDocuments is null (unlimited)', () => {
    const result = checkLimit(proPlan, 'documents_created', 99999);
    expect(result.allowed).toBe(true);
  });
});

// ─── checkSeatLimit ──────────────────────────────────────────────────────────

describe('checkSeatLimit', () => {
  it('allows when adding seats within plan limit', () => {
    const result = checkSeatLimit(starterPlan, 2, 1);
    expect(result.allowed).toBe(true);
  });

  it('blocks when adding seats exceeds plan limit', () => {
    const result = checkSeatLimit(starterPlan, 3, 1); // 3 + 1 > 3
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Seat limit is 3/);
  });
});

// ─── isSubscriptionActive ────────────────────────────────────────────────────

describe('isSubscriptionActive', () => {
  it('returns true for active status', () => {
    expect(isSubscriptionActive('active', null)).toBe(true);
  });

  it('returns false for halted status', () => {
    expect(isSubscriptionActive('halted', null)).toBe(false);
  });

  it('returns false for cancelled status', () => {
    expect(isSubscriptionActive('cancelled', null)).toBe(false);
  });

  it('returns false for past_due status', () => {
    expect(isSubscriptionActive('past_due', null)).toBe(false);
  });

  it('returns true for trial that has not expired', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
    expect(isSubscriptionActive('trial', futureDate)).toBe(true);
  });

  it('returns false for trial that has expired', () => {
    const pastDate = new Date(Date.now() - 1000); // 1 second ago
    expect(isSubscriptionActive('trial', pastDate)).toBe(false);
  });

  it('returns true for trial with no end date set', () => {
    expect(isSubscriptionActive('trial', null)).toBe(true);
  });
});
