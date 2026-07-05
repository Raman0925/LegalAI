import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import JoinPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? 'test-token-abc' : null),
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ joined: true, firmId: 'firm-1', firmName: 'Test Firm' }),
  },
}));

describe('JoinPage', () => {
  it('renders accept invitation button when token is present', async () => {
    render(<JoinPage />);
    expect(await screen.findByRole('button', { name: /accept invitation/i })).toBeInTheDocument();
  });

  it('renders join page title', async () => {
    render(<JoinPage />);
    expect(await screen.findByText(/join your team/i)).toBeInTheDocument();
  });
});
