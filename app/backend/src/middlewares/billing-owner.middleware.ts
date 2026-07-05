import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * requireFirmOwner — Fastify preHandler middleware
 *
 * Restricts billing management routes to firm owners only.
 * Team members and admins cannot create orders, verify payments,
 * or upgrade plans — only the firm owner.
 *
 * Should be applied AFTER authenticate middleware.
 */
export async function requireFirmOwner(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { role } = request.user;

  if (role !== 'owner') {
    reply.status(403).send({
      error: 'FORBIDDEN',
      message: 'Only the firm owner can manage billing.',
    });
    return;
  }
}
