import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    billing: {
      getSubscription: vi.fn().mockResolvedValue({
        subscription: {
          id: 'sub-1',
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          plan: { displayName: 'Starter', priceInr: 0, name: 'starter' },
          currentPeriodEnd: null,
        },
      }),
      getUsage: vi.fn().mockResolvedValue({
        usage: {
          aiCallsToday: 10,
          aiCallsLimit: 50,
          aiCallsPercent: 20,
          documentsTotal: 5,
          documentsLimit: 100,
          seatsUsed: 1,
          seatsLimit: 3,
          storageUsedGb: 0.5,
          storageLimit: 5,
        },
        plan: { displayName: 'Starter' },
      }),
    },
  },
}));

describe('BillingPage', () => {
  it('renders loading state initially and then shows usage details', async () => {
    render(<BillingPage />);
    expect(screen.getByText(/loading billing/i)).toBeInTheDocument();

    // Wait for the billing page to load
    await waitFor(() => {
      expect(screen.queryByText(/loading billing/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Billing & Usage')).toBeInTheDocument();
    expect(screen.getByText('Starter plan')).toBeInTheDocument();
    expect(screen.getByText('10 / 50')).toBeInTheDocument();
  });
});
