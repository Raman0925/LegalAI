'use client';

import { useState, useCallback, useRef } from 'react';
import { useRazorpayScript } from './useRazorpayScript';
import { api } from '@/lib/api';
import type {
  PaymentState,
  CreateOrderResponse,
  RazorpaySuccessResponse,
} from '@/types/payment.types';

/**
 * usePayment — Full payment flow state machine for Razorpay Checkout.
 *
 * Flow: idle → creating_order → payment_open → verifying → success/failed
 *
 * Usage:
 *   const { state, error, initiatePayment, reset } = usePayment();
 *   <button onClick={() => initiatePayment('growth', 'monthly')}>Buy Now</button>
 */
export function usePayment() {
  const scriptLoaded = useRazorpayScript();
  const [state, setState] = useState<PaymentState>('idle');
  const [error, setError] = useState<string | null>(null);
  const isProcessing = useRef(false);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    isProcessing.current = false;
  }, []);

  const initiatePayment = useCallback(async (planName: string, billingCycle: string) => {
    // Prevent double-click
    if (isProcessing.current) return;
    if (!scriptLoaded) {
      setError('Payment system not ready. Please refresh the page.');
      return;
    }

    isProcessing.current = true;
    setError(null);

    try {
      // Step 1: Create order on our backend
      setState('creating_order');
      const order = await api.billing.createOrder(planName, billingCycle) as CreateOrderResponse;

      // Step 2: Open Razorpay Checkout modal in browser
      setState('payment_open');

      const razorpayResponse = await new Promise<RazorpaySuccessResponse>((resolve, reject) => {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || order.keyId,
          amount: String(order.amount),
          currency: order.currency,
          order_id: order.orderId,
          name: 'LegalAI',
          description: `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan — ${billingCycle}`,
          theme: { color: '#2563EB' },
          modal: {
            ondismiss: () => reject({ code: 'PAYMENT_CANCELLED' }),
          },
          handler: (response: RazorpaySuccessResponse) => resolve(response),
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (response: any) => reject(response.error));
        rzp.open();
      });

      // Step 3: Verify payment on our backend
      setState('verifying');
      await api.billing.verifyPayment({
        razorpay_order_id: razorpayResponse.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature: razorpayResponse.razorpay_signature,
      });

      setState('success');

    } catch (err: any) {
      // User cancelled — go back to idle without error
      if (err?.code === 'PAYMENT_CANCELLED') {
        setState('idle');
        setError(null);
        isProcessing.current = false;
        return;
      }

      setState('failed');
      setError(
        err?.description ??
        err?.message ??
        'Payment failed. Please try again.'
      );
    } finally {
      isProcessing.current = false;
    }
  }, [scriptLoaded]);

  return { state, error, initiatePayment, reset, scriptLoaded };
}
