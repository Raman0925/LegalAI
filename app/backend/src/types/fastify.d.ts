import pg from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
  }

  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
      created_at: string;
      updated_at: string;
    };
  }
}
