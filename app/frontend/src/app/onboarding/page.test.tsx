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
  it('renders firm name input and submit button', () => {
    render(<OnboardingPage />);
    expect(screen.getByPlaceholderText(/sharma/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create firm/i })).toBeInTheDocument();
  });

  it('disables button when firm name is empty', () => {
    render(<OnboardingPage />);
    const button = screen.getByRole('button', { name: /create firm/i });
    expect(button).toBeDisabled();
  });

  it('enables button when firm name is entered', () => {
    render(<OnboardingPage />);
    fireEvent.change(screen.getByPlaceholderText(/sharma/i), {
      target: { value: 'My Law Firm' },
    });
    expect(screen.getByRole('button', { name: /create firm/i })).not.toBeDisabled();
  });

  it('shows loading state during submission', async () => {
    render(<OnboardingPage />);
    fireEvent.change(screen.getByPlaceholderText(/sharma/i), {
      target: { value: 'My Law Firm' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create firm/i }));
    await waitFor(() => {
      expect(screen.getByText(/creating/i)).toBeInTheDocument();
    });
  });
});
