'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinPageContent />
    </Suspense>
  );
}

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Guard: if no token, redirect to login
  useEffect(() => {
    if (!token) router.replace('/login');
  }, [token, router]);

  const handleJoin = async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      await api.post('/onboarding/join', { token });
      // Successfully joined — go to dashboard
      router.replace('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not join firm';
      setError(message);
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join your team on LegalAI</CardTitle>
          <CardDescription>
            You&apos;ve been invited to collaborate on LegalAI.
            Click below to accept and access your firm&apos;s workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </p>
          )}
          <Button
            className="w-full"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Accept Invitation & Join Firm'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
