import pg from 'pg';
import { SupabaseClient } from '@supabase/supabase-js';
import { FirmSubscription } from '../domains/billing/billing.types.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    public?: boolean;
  }

  interface FastifyInstance {
    pg: pg.Pool;
    supabase: SupabaseClient;
  }

  interface FastifyRequest {
    // Populated by auth middleware after JWT verification + DB profile lookup
    user: {
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
      created_at: string;
      updated_at: string;
      firmId: string;           // always set — never undefined after auth middleware
      role: string;             // 'owner' | 'admin' | 'member' — from profiles table
    };

    // Populated by planLimit or requireActiveSubscription middleware
    subscription?: FirmSubscription;

    // Attached by @fastify/raw-body plugin — used for webhook signature verification
    rawBody?: string;

    // Track usage record ID for plan-limit TOCTOU race resolution
    usageRecordId?: string | null;

    // Subscription grace period warning — set by requireActiveSubscription middleware
    subscriptionWarning?: {
      message: string;
      gracePeriodEnd: Date | null;
    };
  }
}
