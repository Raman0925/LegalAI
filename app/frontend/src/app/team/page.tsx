'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Member {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
  accepted: boolean;
}

export default function TeamPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMembers = useCallback(async () => {
    try {
      const result = await api.onboarding.getMembers();
      setMembers(result.members);
      setPendingInvites(result.pendingInvites);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load team';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

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
        fetchMembers();
      }
    }
    checkSession();
  }, [router, fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError('');
    setSuccess('');

    try {
      await api.onboarding.invite(inviteEmail.trim());
      setSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      // Refresh to show new pending invite
      await fetchMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send invite';
      setError(message);
    } finally {
      setInviting(false);
    }
  };

  const roleBadgeColor: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    member: 'bg-gray-100 text-gray-800',
  };

  if (checkingSession || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading team...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="text-gray-500 mt-1">Manage your firm&apos;s team members and invitations</p>
      </div>

      {/* Invite New Member */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite Team Member</CardTitle>
          <CardDescription>
            Send an invitation email to add a new member to your firm
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              disabled={inviting}
            />
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{success}</p>
          )}
        </CardContent>
      </Card>

      {/* Current Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {member.fullName || member.email}
                  </p>
                  {member.fullName && (
                    <p className="text-sm text-gray-500">{member.email}</p>
                  )}
                </div>
                <Badge className={roleBadgeColor[member.role] ?? 'bg-gray-100 text-gray-800'}>
                  {member.role}
                </Badge>
              </div>
            ))}

            {members.length === 0 && (
              <p className="py-3 text-sm text-gray-500">No members found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Pending Invitations ({pendingInvites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {pendingInvites.map(invite => {
                // eslint-disable-next-line react-hooks/purity
                const daysLeft = Math.max(
                  0,
                  Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                );
                return (
                  <div key={invite.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
