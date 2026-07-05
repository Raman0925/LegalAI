import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ firm: { id: 'firm-1' } }),
  },
}));

describe('OnboardingPage', () => {
  it('renders firm name input and submit button', async () => {
    render(<OnboardingPage />);
    expect(await screen.findByPlaceholderText(/sharma/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /create firm/i })).toBeInTheDocument();
  });

  it('disables button when firm name is empty', async () => {
    render(<OnboardingPage />);
    const button = await screen.findByRole('button', { name: /create firm/i });
    expect(button).toBeDisabled();
  });

  it('enables button when firm name is entered', async () => {
    render(<OnboardingPage />);
    const input = await screen.findByPlaceholderText(/sharma/i);
    fireEvent.change(input, {
      target: { value: 'My Law Firm' },
    });
    const button = await screen.findByRole('button', { name: /create firm/i });
    expect(button).not.toBeDisabled();
  });

  it('shows loading state during submission', async () => {
    render(<OnboardingPage />);
    const input = await screen.findByPlaceholderText(/sharma/i);
    fireEvent.change(input, {
      target: { value: 'My Law Firm' },
    });
    const button = await screen.findByRole('button', { name: /create firm/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/creating/i)).toBeInTheDocument();
    });
  });
});
