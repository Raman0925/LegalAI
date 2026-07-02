import jwt, { JwtPayload } from 'jsonwebtoken';
import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';

// Routes that skip authentication entirely
const PUBLIC_ROUTES = new Set([
  '/health',
  '/billing/webhook',
  '/billing/plans',
]);

const PUBLIC_PREFIXES = ['/docs', '/favicon.ico'];

export default async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const { url } = request;

  // ── Skip auth for public routes ───────────────────────────────────────────
  if (PUBLIC_ROUTES.has(url) || PUBLIC_PREFIXES.some(p => url.startsWith(p))) {
    return;
  }

  // ── Validate Authorization header ─────────────────────────────────────────
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    const err = new Error('Unauthorized: Missing or invalid token format') as FastifyError;
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.split(' ')[1];

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('Internal Server Error: JWT secret is not configured') as FastifyError;
    err.statusCode = 500;
    throw err;
  }

  // ── Verify JWT ─────────────────────────────────────────────────────────────
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    const err = new Error('Unauthorized: Invalid or expired access token') as FastifyError;
    err.statusCode = 401;
    throw err;
  }

  if (!decoded?.sub) {
    const err = new Error('Unauthorized: Invalid token payload') as FastifyError;
    err.statusCode = 401;
    throw err;
  }

  // ── Look up profile + firmId from DB ──────────────────────────────────────
  // We fetch firmId here so every downstream handler always has it.
  // The profiles table must have a firm_id column set during firm onboarding.
  try {
    const result = await request.server.pg.query(
      `SELECT
         id, email, full_name, avatar_url, firm_id, role,
         created_at, updated_at
       FROM public.profiles
       WHERE id = $1`,
      [decoded.sub],
    );

    const profile = result.rows[0];

    if (!profile) {
      // Graceful fallback: profile sync trigger may not have run yet
      // Use JWT metadata but log a warning — firmId will be empty string
      request.log.warn(
        { userId: decoded.sub },
        'Profile not found in DB — using JWT metadata fallback. firm_id will be empty.'
      );
      request.user = {
        id: decoded.sub,
        email: decoded['email'] as string || '',
        full_name: (decoded['user_metadata'] as Record<string, string>)?.full_name || null,
        avatar_url: (decoded['user_metadata'] as Record<string, string>)?.avatar_url || null,
        firmId: '',           // empty — not a valid UUID, will fail firm-scoped queries safely
        role: 'member',       // default — actual role resolved after firm join
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      request.user = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        firmId: profile.firm_id ?? '',   // firm_id from profiles table
        role: profile.role ?? 'member',  // role from profiles table
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
    }

    request.log.debug(
      { userId: request.user.id, firmId: request.user.firmId },
      'Auth middleware: user resolved'
    );

  } catch (err) {
    request.log.error(err, 'Auth middleware: DB lookup failed');
    const error = new Error('Internal Server Error') as FastifyError;
    error.statusCode = 500;
    throw error;
  }
}
