'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BillingOverview } from '@/components/billing/BillingOverview';

interface UsageSummary {
  aiCallsToday: number;
  aiCallsLimit: number;
  aiCallsPercent: number;
  documentsTotal: number;
  documentsLimit: number | null;
  seatsUsed: number;
  seatsLimit: number;
  storageUsedGb: number;
  storageLimit: number;
}

interface Subscription {
  status: string;
  trialEndsAt: string | null;
  gracePeriodEnd: string | null;
  plan: {
    displayName: string;
    priceInr: number;
    name: string;
  };
  currentPeriodEnd: string | null;
}

function UsageBar({
  label,
  used,
  limit,
  unit = '',
}: {
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
}) {
  const percent = limit ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  const barColor =
    percent >= 90 ? 'bg-red-500' :
    percent >= 70 ? 'bg-yellow-500' :
    'bg-green-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">
          {used.toLocaleString()}{unit} / {limit === null ? '∞' : `${limit.toLocaleString()}${unit}`}
        </span>
      </div>
      {limit !== null && (
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [subRes, usageRes] = await Promise.all([
        api.billing.getSubscription(),
        api.billing.getUsage(),
      ]);
      setSubscription(subRes.subscription);
      setUsage(usageRes.usage);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load billing data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading billing info...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-red-600 bg-red-50 p-4 rounded-lg">{error}</p>
      </div>
    );
  }

  const isTrialing = subscription?.status === 'trial';
  const isGracePeriod = subscription?.status === 'grace_period';
  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const graceDaysLeft = subscription?.gracePeriodEnd
    ? Math.max(0, Math.ceil((new Date(subscription.gracePeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Usage</h1>
          <p className="text-gray-500 mt-1">Manage your subscription and monitor usage</p>
        </div>
      </div>

      {/* Grace Period Warning */}
      {isGracePeriod && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-600 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-medium text-amber-800">
                Payment failed — {graceDaysLeft} days remaining in grace period
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Please update your payment method to avoid service interruption.
              </p>
              <Button
                variant="outline"
                className="mt-2 text-amber-800 border-amber-300 hover:bg-amber-100"
                onClick={() => router.push('/billing/plans')}
              >
                Update Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Current Plan</CardTitle>
            <Badge className={
              isTrialing ? 'bg-blue-100 text-blue-800' :
              isGracePeriod ? 'bg-amber-100 text-amber-800' :
              'bg-green-100 text-green-800'
            }>
              {isTrialing
                ? `Trial — ${trialDaysLeft} days left`
                : isGracePeriod
                ? `Grace Period — ${graceDaysLeft} days left`
                : subscription?.status ?? 'Unknown'}
            </Badge>
          </div>
          <CardDescription>
            {subscription?.plan.displayName} plan
            {subscription?.plan.priceInr
              ? ` — ₹${(subscription.plan.priceInr / 100).toLocaleString()}/month`
              : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => router.push('/billing/plans')}
          >
            {isTrialing ? 'Choose a Plan' : 'Upgrade Plan'}
          </Button>
        </CardContent>
      </Card>

      {/* Usage Dashboard */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage This Period</CardTitle>
            <CardDescription>
              Your current resource consumption
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar
              label="AI Calls (today)"
              used={usage.aiCallsToday}
              limit={usage.aiCallsLimit}
            />
            <UsageBar
              label="Documents"
              used={usage.documentsTotal}
              limit={usage.documentsLimit}
            />
            <UsageBar
              label="Team Seats"
              used={usage.seatsUsed}
              limit={usage.seatsLimit}
            />
            <UsageBar
              label="Storage"
              used={usage.storageUsedGb}
              limit={usage.storageLimit}
              unit=" GB"
            />
          </CardContent>
        </Card>
      )}

      {/* Payment History & Invoices */}
      <BillingOverview />
    </div>
  );
}
