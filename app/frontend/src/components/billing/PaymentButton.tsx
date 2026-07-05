'use client';

import { usePayment } from '@/hooks/usePayment';
import type { PaymentState } from '@/types/payment.types';

interface PaymentButtonProps {
  planName: string;
  billingCycle: string;
  label?: string;
  onSuccess?: () => void;
}

const BUTTON_TEXT: Record<PaymentState, string> = {
  idle: 'Buy Now',
  creating_order: 'Preparing...',
  payment_open: 'Complete payment...',
  verifying: 'Verifying...',
  success: '✓ Payment Successful',
  failed: 'Retry Payment',
};

/**
 * PaymentButton — Reusable payment CTA with full state management.
 *
 * Opens the Razorpay Checkout modal inline (no page redirect).
 * Shows state-driven labels and error messages.
 */
export function PaymentButton({
  planName,
  billingCycle,
  label = 'Buy Now',
  onSuccess,
}: PaymentButtonProps) {
  const { state, error, initiatePayment } = usePayment();

  const handleClick = async () => {
    await initiatePayment(planName, billingCycle);
    // onSuccess callback handled via useEffect on state change
  };

  // Call onSuccess when state transitions to success
  if (state === 'success' && onSuccess) {
    // Use setTimeout to avoid calling onSuccess during render
    setTimeout(onSuccess, 0);
  }

  const isDisabled = ['creating_order', 'payment_open', 'verifying', 'success'].includes(state);
  const buttonText = state === 'idle' ? label : BUTTON_TEXT[state];

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          w-full px-6 py-3 rounded-lg font-semibold text-white
          transition-all duration-200 text-sm
          ${state === 'success'
            ? 'bg-emerald-600 cursor-default'
            : state === 'failed'
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }
          ${isDisabled ? 'opacity-70 cursor-not-allowed' : ''}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
      >
        {state === 'creating_order' || state === 'verifying' ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {buttonText}
          </span>
        ) : (
          buttonText
        )}
      </button>
      {error && state === 'failed' && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
