'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { BillingOverviewResponse, PaymentRecord, InvoiceRecord } from '@/types/payment.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * BillingOverview — Displays current plan, payment history, and invoices.
 * Fetches data from /billing/overview endpoint.
 */
export function BillingOverview() {
  const [data, setData] = useState<BillingOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await api.billing.getOverview() as BillingOverviewResponse;
      setData(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load billing overview';
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
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse flex flex-col gap-4 w-full">
          <div className="h-24 bg-gray-100 rounded-lg" />
          <div className="h-48 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 bg-red-50 p-4 rounded-lg">{error}</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Payment History */}
      {data.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Payments</CardTitle>
            <CardDescription>Your latest payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {data.payments.map((payment: PaymentRecord) => (
                <div key={payment.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      ₹{(payment.amountPaise / 100).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(payment.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {payment.paymentMethod && (
                      <span className="text-xs text-gray-500 capitalize">
                        {payment.paymentMethod}
                      </span>
                    )}
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      {data.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoices</CardTitle>
            <CardDescription>Download your billing invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {data.invoices.map((invoice: InvoiceRecord) => (
                <div key={invoice.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </span>
                    <span className="text-xs text-gray-500">
                      ₹{(invoice.totalPaise / 100).toLocaleString()}
                      {invoice.billingPeriodStart && invoice.billingPeriodEnd && (
                        <> · {new Date(invoice.billingPeriodStart).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <InvoiceStatusBadge status={invoice.status} />
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Status Badge Components ─────────────────────────────────────────────────

function PaymentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    captured: 'bg-green-100 text-green-800',
    created: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    refunded: 'bg-purple-100 text-purple-800',
    expired: 'bg-gray-100 text-gray-600',
  };

  return (
    <Badge className={styles[status] ?? 'bg-gray-100 text-gray-600'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    issued: 'bg-blue-100 text-blue-800',
    draft: 'bg-gray-100 text-gray-600',
    void: 'bg-red-100 text-red-800',
  };

  return (
    <Badge className={styles[status] ?? 'bg-gray-100 text-gray-600'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
