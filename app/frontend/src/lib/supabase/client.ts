import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a client-side Supabase client.
 * Uses NEXT_PUBLIC_ prefixed environment variables which are safe for client-side execution.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase client-side environment variables are missing.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
