import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    },
  },
}));

describe('PlansPage', () => {
  it('renders loading state initially', () => {
    render(<PlansPage />);
    expect(screen.getByText(/loading plans/i)).toBeInTheDocument();
  });
});
