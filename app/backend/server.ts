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
import fastifySSE from '@fastify/sse';
import loggerConfig from '#config/loggerConfig.js';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { swaggerConfig, swaggerUiConfig } from '#config/swaggerConfig.js';
import { MAX_UPLOAD_BYTES } from '#domains/document/document.constant.js';
import { createSupabaseAdminClient } from '#utils/storage/supabaseClient.js';

const fastify = Fastify({ logger: loggerConfig });

// Decorate fastify with supabase client
fastify.decorate('supabase', createSupabaseAdminClient());

// Register plugins
fastify.register(cors, {
  origin: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
fastify.register(dbConnector);
fastify.register(websocket);
fastify.register(fastifySSE.default);
fastify.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES } });
fastify.register(swagger, swaggerConfig);
fastify.register(swaggerUi, swaggerUiConfig);

// Register global middlewares
fastify.addHook('onRequest', requestContextMiddleware);
fastify.addHook('preHandler', authMiddleware);

// Register domain routes
fastify.register(healthController);
fastify.register(userController, { prefix: '/auth' });
fastify.register(chatController, { prefix: '/chat' });
fastify.register(documentController, { prefix: '/documents' });
fastify.register(matterController, { prefix: '/matters' });
fastify.register(researchController, { prefix: '/api' });

// Register global error handler
fastify.setErrorHandler(errorHandler);

const startServer = async () => {
  try {
    await fastify.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' });
    fastify.log.info(`Server running on http://localhost:${process.env.PORT || 3000}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();
