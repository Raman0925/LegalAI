import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Health Controller Plugin
 * Defines health status check route for deployments.
 */
export default async function healthController(
  fastify: FastifyInstance,
  options: FastifyPluginOptions,
) {
  fastify.get(
    '/health',
    {
      schema: {
        description:
          'Production-ready health check endpoint to verify system and database connectivity.',
        tags: ['Health'],
        response: {
          200: {
            description: 'System is healthy and database is connected.',
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              uptime: { type: 'number' },
              services: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          503: {
            description: 'System is unhealthy or database is disconnected.',
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              uptime: { type: 'number' },
              error: { type: 'string' },
              services: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let dbStatus = 'UP';
      let hasError = false;
      let errorMessage = '';

      try {
        // Query pg to check DB connection
        await fastify.pg.query('SELECT 1');
      } catch (err) {
        dbStatus = 'DOWN';
        hasError = true;
        errorMessage = err instanceof Error ? err.message : String(err);
        fastify.log.error(err, 'Health check database query failed');
      }

      const healthStatus = {
        status: hasError ? 'DOWN' : 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          database: {
            status: dbStatus,
          },
        },
        ...(hasError && { error: errorMessage }),
      };

      if (hasError) {
        reply.status(503).send(healthStatus);
      } else {
        reply.send(healthStatus);
      }
    },
  );
}
