import { createBrowserClient } from '@/lib/supabase/client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function get<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Typed API methods — extend as new backend routes are added
export const api = {
  auth: {
    me: () => get<{ id: string; email: string; full_name: string | null; avatar_url: string | null; created_at: string; updated_at: string }>('/auth/me'),
    updateProfile: (body: { full_name?: string | null; avatar_url?: string | null }) =>
      put<{ id: string; email: string; full_name: string | null; avatar_url: string | null; updated_at: string }>('/auth/me', body),
  },
  chat: {
    send: (message: string, history: { role: string; content: string }[], tier?: string) =>
      post<{ text: string; usage: { inputTokens: number; outputTokens: number } }>('/chat', { message, history, tier }),
  },
};
