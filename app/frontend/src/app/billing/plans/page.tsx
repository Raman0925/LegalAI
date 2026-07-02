'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
    '50 AI calls/day',
    '100 documents',
    '5 GB storage',
  ],
  growth: [
    'Up to 10 team members',
    '200 AI calls/day',
    '1,000 documents',
    '25 GB storage',
    'Priority support',
  ],
  pro: [
    'Up to 25 team members',
    '500 AI calls/day',
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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  const handleUpgrade = async (planName: string) => {
    setActionLoading(planName);
    try {
      const result = await api.billing.upgrade(planName);
      if (result.upgradeUrl) {
        window.open(result.upgradeUrl, '_blank');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upgrade failed';
      setError(message);
    } finally {
      setActionLoading(null);
    }
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md text-center">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.name;
          const features = PLAN_FEATURES[plan.name] ?? [];

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
                  {plan.priceInr > 0
                    ? <span className="text-2xl font-bold text-gray-900">₹{(plan.priceInr / 100).toLocaleString()}<span className="text-sm font-normal text-gray-500">/mo</span></span>
                    : <span className="text-2xl font-bold text-gray-900">Custom</span>
                  }
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

                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent || actionLoading === plan.name}
                  onClick={() => handleUpgrade(plan.name)}
                >
                  {isCurrent
                    ? 'Current'
                    : actionLoading === plan.name
                    ? 'Processing...'
                    : plan.name === 'enterprise'
                    ? 'Contact Sales'
                    : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
