import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
  FastifyError,
} from 'fastify';
import { createDocumentService } from './document.service.js';
import {
  documentResponseSchema,
  documentListResponseSchema,
  uploadResponseSchema,
  statusResponseSchema,
  errorResponseSchema,
} from './document.validator.js';
import { MAX_UPLOAD_BYTES } from './document.constant.js';
import { planLimit } from '#middlewares/plan-limits.middleware.js';
import { trackAfterResponse } from '#middlewares/usage-tracker.middleware.js';
import * as billingRepo from '#domains/billing/billing.repository.js';

export default async function documentController(
  fastify: FastifyInstance,
  options: FastifyPluginOptions,
) {
  const documentService = createDocumentService(fastify.pg);

  fastify.post(
    '/upload',
    {
      schema: {
        tags: ['Documents'],
        summary: 'Upload a document for ingestion',
        security: [{ bearerAuth: [] }],
        response: {
          202: uploadResponseSchema,
          '4xx': errorResponseSchema,
        },
      },
      // documents_created is enforced (and tracked) here; storage_bytes is
      // checked manually below since the byte count is only known after the
      // multipart body is parsed — planLimit always tracks quantity=1.
      preHandler: [planLimit('documents_created')],
      onResponse: [trackAfterResponse('documents_created')],
    } as Record<string, unknown>,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
      if (!file) {
        const error = new Error('No file provided') as FastifyError;
        error.statusCode = 400;
        throw error;
      }

      const buffer = await file.toBuffer();
      const { id: userId, firmId } = request.user;

      const { subscription } = request;
      if (subscription) {
        const currentStorageBytes = await billingRepo.getTotalUsageForFirm(
          fastify.supabase,
          firmId,
          'storage_bytes',
        );
        const limitBytes = subscription.plan.maxStorageGb * 1024 ** 3;
        if (currentStorageBytes + buffer.length > limitBytes) {
          const error = new Error(
            `Storage limit reached (${subscription.plan.maxStorageGb} GB). Upgrade your plan for more storage.`,
          ) as FastifyError;
          error.statusCode = 413;
          throw error;
        }
      }

      const result = await documentService.upload(
        userId,
        firmId,
        {
          filename: file.filename,
          mimetype: file.mimetype,
          buffer,
        },
        request.log,
      );

      // Best-effort — storage tracking failure should not fail the upload.
      billingRepo.trackUsage(fastify.supabase, firmId, 'storage_bytes', buffer.length);

      return reply.code(202).send(result);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        tags: ['Documents'],
        summary: 'List documents for the authenticated user',
        security: [{ bearerAuth: [] }],
        response: {
          200: documentListResponseSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      return documentService.list(request.user.firmId);
    },
  );

  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Documents'],
        summary: 'Get a single document',
        security: [{ bearerAuth: [] }],
        response: {
          200: documentResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return documentService.getById(request.params.id, request.user.firmId);
    },
  );

  fastify.get(
    '/:id/status',
    {
      schema: {
        tags: ['Documents'],
        summary: 'Poll document ingestion status',
        security: [{ bearerAuth: [] }],
        response: {
          200: statusResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return documentService.getStatus(request.params.id, request.user.firmId);
    },
  );

  fastify.delete(
    '/:id',
    {
      schema: {
        tags: ['Documents'],
        summary: 'Delete a document and its chunks',
        security: [{ bearerAuth: [] }],
        response: {
          204: { type: 'null' },
          404: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await documentService.remove(request.params.id, request.user.firmId);
      return reply.code(204).send();
    },
  );
}
