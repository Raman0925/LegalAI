/**
 * Idempotency key generator for payment orders.
 *
 * Format: {firmId}:{planName}:{billingCycle}:{hourWindow}
 *
 * Same inputs within the same UTC hour produce the same key.
 * This prevents double-charge if a user clicks "Buy" twice quickly,
 * while allowing a fresh purchase attempt after an hour has passed.
 */
export function generateIdempotencyKey(
  firmId: string,
  planName: string,
  billingCycle: string
): string {
  const now = new Date();
  const window = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  return `${firmId}:${planName}:${billingCycle}:${window}`;
}
