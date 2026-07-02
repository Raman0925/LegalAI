import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamPage from './page';

vi.mock('@/lib/api', () => ({
  api: {
    onboarding: {
      getMembers: vi.fn().mockResolvedValue({
        members: [
          { id: 'user-1', email: 'owner@firm.com', fullName: 'Owner User', role: 'owner' },
          { id: 'user-2', email: 'member@firm.com', fullName: null, role: 'member' },
        ],
        pendingInvites: [
          { id: 'inv-1', email: 'invited@firm.com', expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), accepted: false },
        ],
      }),
      invite: vi.fn().mockResolvedValue({ invited: true, email: 'test@firm.com' }),
    },
  },
}));

describe('TeamPage', () => {
  it('renders loading state initially', () => {
    render(<TeamPage />);
    expect(screen.getByText(/loading team/i)).toBeInTheDocument();
  });
});
