'use client';

import { useEffect, useState } from 'react';

/**
 * Dynamically loads the Razorpay Checkout.js script in the browser.
 * Returns true when the script is loaded and `window.Razorpay` is available.
 *
 * Next.js note: This uses `useEffect` so it only runs client-side.
 * No native SDK needed — the browser script handles the payment modal.
 */
export function useRazorpayScript(): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Already loaded (e.g., HMR re-render)
    if (typeof window !== 'undefined' && window.Razorpay) {
      setLoaded(true);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="razorpay"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => {
      console.error('[Razorpay] Failed to load checkout script');
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove the script on cleanup — it should persist across navigations
    };
  }, []);

  return loaded;
}
