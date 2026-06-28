import 'dotenv/config';
import Fastify from 'fastify';
import dbConnector from '#plugins/dbConnector.js';
import errorHandler from '#middlewares/errorHandler.js';
import { requestContextMiddleware } from '#middlewares/requestContext.middleware.js';
import authMiddleware from '#middlewares/auth.middleware.js';
import userController from '#domains/user/user.controller.js';
import chatController from '#domains/chat/chat.controller.js';
import healthController from '#domains/health/health.controller.js';
import documentController from '#domains/document/document.controller.js';
import matterController from '#domains/matter/matter.controller.js';
import { researchController } from '#domains/research/research.controller.js';
import { contractsController } from '#domains/contracts/contracts.controller.js';
import { editorController } from '#domains/editor/editor.controller.js';
import { billingController } from '#domains/billing/billing.controller.js';
import fastifySSE from '@fastify/sse';
import loggerConfig from '#config/loggerConfig.js';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import rawBody from 'fastify-raw-body';
import { swaggerConfig, swaggerUiConfig } from '#config/swaggerConfig.js';
import { MAX_UPLOAD_BYTES } from '#domains/document/document.constant.js';
import { createSupabaseAdminClient } from '#utils/storage/supabaseClient.js';

const fastify = Fastify({ logger: loggerConfig });

// ─── Decorate with Supabase client ───────────────────────────────────────────
fastify.decorate('supabase', createSupabaseAdminClient());

const startServer = async () => {
  // ── Security plugins ────────────────────────────────────────────────────────

  // Helmet adds HTTP security headers:
  // X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // disabled — API server, no HTML served
  });

  // CORS: restrict to our frontend origin in production
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL]
      : true,              // allow all in dev (FRONTEND_URL not set)
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global rate limit: 200 req/min per IP
  // SSE routes are long-lived connections — rate limiting on connect is fine
  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down.',
      statusCode: 429,
    }),
  });

  // Raw body: attached only to routes with config.rawBody = true
  // Required for Razorpay webhook HMAC signature verification
  await fastify.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });

  // ── Feature plugins ─────────────────────────────────────────────────────────
  await fastify.register(dbConnector);
  await fastify.register(websocket);
  await fastify.register(fastifySSE.default);
  await fastify.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES } });
  await fastify.register(swagger, swaggerConfig);
  await fastify.register(swaggerUi, swaggerUiConfig);

  // ── Global middleware hooks ─────────────────────────────────────────────────
  fastify.addHook('onRequest', requestContextMiddleware);
  fastify.addHook('preHandler', authMiddleware);

  // ── Domain routes ───────────────────────────────────────────────────────────
  fastify.register(healthController);
  fastify.register(userController,      { prefix: '/auth' });
  fastify.register(chatController,      { prefix: '/chat' });
  fastify.register(documentController,  { prefix: '/documents' });
  fastify.register(matterController,    { prefix: '/matters' });
  fastify.register(researchController,  { prefix: '/api' });
  fastify.register(contractsController, { prefix: '/contracts' });
  fastify.register(editorController,    { prefix: '/editor' });
  fastify.register(billingController,   { prefix: '/billing' });

  // ── Global error handler ────────────────────────────────────────────────────
  fastify.setErrorHandler(errorHandler);

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  // Handles SIGTERM (sent by Docker/Kubernetes on deploy) and SIGINT (Ctrl+C).
  // Fastify.close() drains in-flight requests before exiting.
  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal} — shutting down gracefully`);
    try {
      await fastify.close();
      fastify.log.info('Server closed cleanly');
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // ── Start listening ─────────────────────────────────────────────────────────
  try {
    const port = Number(process.env.PORT || 3000);
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
