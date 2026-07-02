import { describe, it, expect, vi } from 'vitest';
import { createFirm, getSeatCount, getFirmById, markInviteAccepted } from './onboarding.repository.js';

describe('createFirm', () => {
  it('throws with message when supabase insert fails', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'duplicate key value' },
            }),
          }),
        }),
      }),
    } as never;

    await expect(createFirm(mockSupabase, {
      name: 'Test Firm',
      slug: 'test-firm-abc1',
      ownerId: 'user-1',
    })).rejects.toThrow('Failed to create firm');
  });

  it('returns mapped firm on success', async () => {
    const mockRow = {
      id: 'firm-1',
      name: 'Test Firm',
      slug: 'test-firm-abc1',
      owner_id: 'user-1',
      plan_name: 'starter',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockRow,
              error: null,
            }),
          }),
        }),
      }),
    } as never;

    const firm = await createFirm(mockSupabase, {
      name: 'Test Firm',
      slug: 'test-firm-abc1',
      ownerId: 'user-1',
    });

    expect(firm.id).toBe('firm-1');
    expect(firm.name).toBe('Test Firm');
    expect(firm.slug).toBe('test-firm-abc1');
    expect(firm.ownerId).toBe('user-1');
  });
});

describe('getSeatCount', () => {
  it('returns 0 when query fails', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'error' } }),
        }),
      }),
    } as never;

    const count = await getSeatCount(mockSupabase, 'firm-1');
    expect(count).toBe(0);
  });

  it('returns count when query succeeds', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
        }),
      }),
    } as never;

    const count = await getSeatCount(mockSupabase, 'firm-1');
    expect(count).toBe(3);
  });
});

describe('getFirmById', () => {
  it('returns null when firm not found', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'not found' },
            }),
          }),
        }),
      }),
    } as never;

    const result = await getFirmById(mockSupabase, 'nonexistent');
    expect(result).toBeNull();
  });
});

describe('markInviteAccepted', () => {
  it('throws when update fails', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'update failed' },
          }),
        }),
      }),
    } as never;

    await expect(markInviteAccepted(mockSupabase, 'invite-1'))
      .rejects.toThrow('Failed to mark invite accepted');
  });
});
