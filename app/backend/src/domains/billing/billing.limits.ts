import { SubscriptionPlan, UsageMetric } from './billing.types.js';

export interface LimitCheck {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
}

/**
 * Check if a firm is allowed to perform a metered action.
 * Call this BEFORE executing any AI call or document creation.
 */
export function checkLimit(
  plan: SubscriptionPlan,
  metric: UsageMetric,
  currentUsage: number
): LimitCheck {
  switch (metric) {
    case 'ai_calls': {
      const limit = plan.maxAiCallsDay;
      if (currentUsage >= limit) {
        return {
          allowed: false,
          reason: `Daily AI call limit reached (${currentUsage}/${limit}). Upgrade your plan.`,
          current: currentUsage,
          limit,
        };
      }
      return { allowed: true, current: currentUsage, limit };
    }

    case 'documents_created': {
      if (plan.maxDocuments === null) return { allowed: true };   // unlimited
      if (currentUsage >= plan.maxDocuments) {
        return {
          allowed: false,
          reason: `Document limit reached (${currentUsage}/${plan.maxDocuments}). Upgrade your plan.`,
          current: currentUsage,
          limit: plan.maxDocuments,
        };
      }
      return { allowed: true, current: currentUsage, limit: plan.maxDocuments };
    }

    case 'storage_bytes': {
      const limitBytes = plan.maxStorageGb * 1024 * 1024 * 1024;
      if (currentUsage >= limitBytes) {
        return {
          allowed: false,
          reason: `Storage limit reached. Upgrade your plan for more storage.`,
          current: currentUsage,
          limit: limitBytes,
        };
      }
      return { allowed: true };
    }

    default:
      return { allowed: true };
  }
}

/**
 * Check if adding N seats is within plan limits.
 */
export function checkSeatLimit(
  plan: SubscriptionPlan,
  currentSeats: number,
  addingSeats: number
): LimitCheck {
  const total = currentSeats + addingSeats;
  if (total > plan.maxSeats) {
    return {
      allowed: false,
      reason: `Seat limit is ${plan.maxSeats} for ${plan.displayName} plan. Upgrade to add more users.`,
      current: currentSeats,
      limit: plan.maxSeats,
    };
  }
  return { allowed: true };
}

/**
 * Check if subscription status allows API access.
 * Supports grace_period — allows access during the 7-day grace window
 * after payment failure, before restricting.
 */
export function isSubscriptionActive(
  status: string,
  trialEndsAt: Date | null,
  gracePeriodEnd?: Date | null
): boolean {
  if (status === 'active') return true;
  if (status === 'trial') {
    if (!trialEndsAt) return true;
    return new Date() < trialEndsAt;
  }
  if (status === 'grace_period') {
    if (!gracePeriodEnd) return true;
    return new Date() < gracePeriodEnd;
  }
  return false;
}
