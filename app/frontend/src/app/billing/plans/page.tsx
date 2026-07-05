'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PaymentButton } from '@/components/billing/PaymentButton';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  priceInr: number;
  maxSeats: number;
  maxDocuments: number | null;
  maxAiCallsDay: number;
  maxStorageGb: number;
}

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    'Up to 3 team members',
    '100 AI calls/day',
    '50 documents',
    '5 GB storage',
  ],
  growth: [
    'Up to 10 team members',
    '500 AI calls/day',
    '250 documents',
    '20 GB storage',
    'Priority support',
  ],
  pro: [
    'Up to 25 team members',
    '2,000 AI calls/day',
    'Unlimited documents',
    '100 GB storage',
    'Priority support',
    'Custom integrations',
  ],
  enterprise: [
    'Unlimited team members',
    'Unlimited AI calls',
    'Unlimited documents',
    'Unlimited storage',
    'Dedicated support',
    'Custom deployment',
    'SLA guarantee',
  ],
};

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        api.billing.getPlans(),
        api.billing.getSubscription().catch(() => null),
      ]);
      setPlans(plansRes.plans);
      if (subRes?.subscription) {
        setCurrentPlan(subRes.subscription.plan.name);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load plans';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPrice = (plan: Plan) => {
    if (plan.priceInr === 0) return null;
    if (billingCycle === 'yearly') {
      // Yearly: 10 months price (2 months free)
      return Math.round(plan.priceInr * 10);
    }
    return plan.priceInr;
  };

  const getMonthlyEquivalent = (plan: Plan) => {
    if (plan.priceInr === 0) return null;
    if (billingCycle === 'yearly') {
      return Math.round((plan.priceInr * 10) / 12);
    }
    return plan.priceInr;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Choose Your Plan</h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Scale your legal practice with the right plan. All plans include a 14-day free trial.
        </p>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            billingCycle === 'monthly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            billingCycle === 'yearly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Yearly
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            billingCycle === 'yearly'
              ? 'bg-green-500 text-white'
              : 'bg-green-100 text-green-700'
          }`}>
            Save 17%
          </span>
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md text-center">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.name;
          const features = PLAN_FEATURES[plan.name] ?? [];
          const price = getPrice(plan);
          const monthlyEquivalent = getMonthlyEquivalent(plan);

          return (
            <Card
              key={plan.id}
              className={`relative ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}
            >
              {isCurrent && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white">
                  Current Plan
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                <CardDescription>
                  {price !== null ? (
                    <div className="space-y-1">
                      <span className="text-2xl font-bold text-gray-900">
                        ₹{(monthlyEquivalent! / 100).toLocaleString()}
                        <span className="text-sm font-normal text-gray-500">/mo</span>
                      </span>
                      {billingCycle === 'yearly' && (
                        <div className="text-xs text-gray-500">
                          Billed ₹{(price / 100).toLocaleString()}/year
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-2xl font-bold text-gray-900">Custom</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.name === 'enterprise' ? (
                  <Button className="w-full" variant="outline" disabled={isCurrent}>
                    {isCurrent ? 'Current' : 'Contact Sales'}
                  </Button>
                ) : isCurrent ? (
                  <Button className="w-full" variant="outline" disabled>
                    Current
                  </Button>
                ) : (
                  <PaymentButton
                    planName={plan.name}
                    billingCycle={billingCycle}
                    label="Select Plan"
                    onSuccess={() => router.push('/dashboard')}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
