import { FastifyRequest, FastifyReply } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { deleteUsageRecord } from '#domains/billing/billing.repository.js';
import { UsageMetric } from '#domains/billing/billing.types.js';

/**
 * trackAfterResponse — Fastify onResponse hook factory
 *
 * Checks if the request failed (statusCode >= 400), and if so,
 * deletes/refunds the usage record created in the preHandler to ensure
 * exact count tracking without TOCTOU race conditions.
 *
 * Usage in a route:
 *   app.post('/chat', {
 *     preHandler: [authenticate, planLimit('ai_calls')],
 *     onResponse: [trackAfterResponse('ai_calls')],
 *   }, handler)
 */
export function trackAfterResponse(metric: UsageMetric, quantity = 1) {
  return async function trackUsageAfterResponse(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {

    // If the request was successful, keep the tracked usage
    if (reply.statusCode < 400) return;

    // If there is no usage record ID to refund, do nothing
    const { usageRecordId } = request;
    if (!usageRecordId) return;

    const supabase = request.server.supabase as SupabaseClient;

    // Refund/delete the record on failure
    deleteUsageRecord(supabase, usageRecordId).catch(err => {
      console.error(`[usage-tracker] Failed to refund usage record ${usageRecordId}:`, err);
    });
  };
}
