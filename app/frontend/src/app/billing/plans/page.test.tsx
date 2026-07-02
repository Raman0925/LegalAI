import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PlansPage from './page';

vi.mock('@/lib/api', () => ({
  api: {
    billing: {
      getPlans: vi.fn().mockResolvedValue({
        plans: [
          { id: '1', name: 'starter', displayName: 'Starter', priceInr: 0, maxSeats: 3, maxDocuments: 100, maxAiCallsDay: 50, maxStorageGb: 5 },
          { id: '2', name: 'growth', displayName: 'Growth', priceInr: 99900, maxSeats: 10, maxDocuments: 1000, maxAiCallsDay: 200, maxStorageGb: 25 },
        ],
      }),
      getSubscription: vi.fn().mockResolvedValue({
        subscription: { plan: { name: 'starter' } },
      }),
      upgrade: vi.fn(),
    },
  },
}));

describe('PlansPage', () => {
  it('renders loading state initially and then shows plans', async () => {
    render(<PlansPage />);
    expect(screen.getByText(/loading plans/i)).toBeInTheDocument();

    // Wait for the loading state to disappear
    await waitFor(() => {
      expect(screen.queryByText(/loading plans/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
  });
});
