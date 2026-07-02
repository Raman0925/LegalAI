import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  it('renders loading state initially and then shows members', async () => {
    render(<TeamPage />);
    expect(screen.getByText(/loading team/i)).toBeInTheDocument();

    // Wait for the loading state to disappear and members to load
    await waitFor(() => {
      expect(screen.queryByText(/loading team/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Owner User')).toBeInTheDocument();
    expect(screen.getByText('member@firm.com')).toBeInTheDocument();
    expect(screen.getByText('invited@firm.com')).toBeInTheDocument();
  });
});
