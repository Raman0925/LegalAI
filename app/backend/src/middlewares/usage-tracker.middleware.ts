import { FastifyRequest, FastifyReply } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { trackUsage } from '#domains/billing/billing.repository.js';
import { UsageMetric } from '#domains/billing/billing.types.js';

/**
 * trackAfterResponse — Fastify onResponse hook factory
 *
 * Increments a usage counter AFTER the response has been sent.
 * This means it never slows down the user's request — it runs
 * entirely in the background.
 *
 * IMPORTANT: Wire this as onResponse, NOT preHandler.
 * onResponse fires after the HTTP response is committed to the client.
 *
 * Usage in a route:
 *   app.post('/chat', {
 *     preHandler: [authenticate, planLimit('ai_calls')],
 *     onResponse: [trackAfterResponse('ai_calls')],
 *   }, handler)
 *
 * What it does:
 *   1. Skips tracking on error responses (status >= 400)
 *   2. Fires trackUsage as a non-blocking promise
 *   3. Logs errors silently — usage tracking never crashes the app
 */
export function trackAfterResponse(metric: UsageMetric, quantity = 1) {
  return async function trackUsageAfterResponse(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {

    // ── Only track successful responses ───────────────────────────────────────
    // If the route returned 4xx or 5xx, the action didn't succeed — don't count it.
    if (reply.statusCode >= 400) return;

    const user = request.user;
    if (!user) return;

    const firmId = user.firmId ?? '00000000-0000-0000-0000-000000000000';
    const supabase = request.server.supabase as SupabaseClient;

    // ── Fire and forget — non-blocking ────────────────────────────────────────
    // trackUsage inserts a row to usage_records. We don't await it
    // so the response is already sent before this DB write begins.
    trackUsage(supabase, firmId, metric, quantity).catch(err => {
      // Log the error but never re-throw — usage tracking is non-critical
      console.error(`[usage-tracker] Failed to track ${metric} for firm ${firmId}:`, err);
    });
  };
}
