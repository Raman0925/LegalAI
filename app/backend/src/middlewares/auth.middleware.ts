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

  if (PUBLIC_ROUTES.has(url) || PUBLIC_PREFIXES.some(p => url.startsWith(p))) {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    const err = new Error('Unauthorized: Missing or invalid token format') as FastifyError;
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.split(' ')[1];

  // ── Verify JWT via Supabase ──────────────────────────────────────────────
  // getClaims() verifies the signature locally against Supabase's cached JWKS
  // (supports both legacy HS256 and the newer per-project ES256/RS256 signing
  // keys) so we never have to know the algorithm/secret ourselves.
  const { data, error } = await request.server.supabase.auth.getClaims(token);
  const claims = data?.claims;

  if (error || !claims?.sub) {
    const err = new Error('Unauthorized: Invalid or expired access token') as FastifyError;
    err.statusCode = 401;
    throw err;
  }

  try {
    const result = await request.server.pg.query(
      `SELECT
         id, email, full_name, avatar_url, firm_id, role,
         created_at, updated_at
       FROM public.profiles
       WHERE id = $1`,
      [claims.sub],
    );

    const profile = result.rows[0];

    if (!profile) { 
      request.log.warn(
        { userId: claims.sub },
        'Profile not found in DB — using JWT metadata fallback. firm_id will be empty.'
      );
      request.user = {
        id: claims.sub,
        email: claims['email'] as string || '',
        full_name: (claims['user_metadata'] as Record<string, string>)?.full_name || null,
        avatar_url: (claims['user_metadata'] as Record<string, string>)?.avatar_url || null,
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
        firmId: profile.firm_id ?? '',
        role: profile.role ?? 'member',
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
