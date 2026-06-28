import pg from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
    supabase: SupabaseClient;
  }

  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
      created_at: string;
      updated_at: string;
      firmId?: string;
    };
  }
}
