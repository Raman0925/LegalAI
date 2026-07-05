'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createBrowserClient } from '@/lib/supabase/client';

export default function OnboardingPage() {
  const router = useRouter();
  const [firmName, setFirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createBrowserClient();
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      } else {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, [router]);

  const handleCreate = async () => {
    if (!firmName.trim()) return;
    setLoading(true);
    setError('');

    try {
      await api.post('/onboarding/firm', { firmName: firmName.trim() });
      router.replace('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo / Brand */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">LegalAI</h1>
          <p className="text-gray-500 mt-1">AI-powered legal intelligence</p>
        </div>

        {/* Firm Setup Card */}
        <Card>
          <CardHeader>
            <CardTitle>Set up your firm</CardTitle>
            <CardDescription>
              You&apos;ll get 14 days free — no credit card required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Firm name
              </label>
              <Input
                placeholder="e.g. Sharma & Associates"
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={loading || !firmName.trim()}
            >
              {loading ? 'Creating your firm...' : 'Create Firm & Start Free Trial'}
            </Button>

            <p className="text-xs text-center text-gray-400">
              14 days free on the Starter plan. Upgrade anytime.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
