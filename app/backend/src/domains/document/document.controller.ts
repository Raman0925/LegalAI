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
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
      if (!file) {
        const error = new Error('No file provided') as FastifyError;
        error.statusCode = 400;
        throw error;
      }

      const buffer = await file.toBuffer();
      const result = await documentService.upload(
        request.user.id,
        {
          filename: file.filename,
          mimetype: file.mimetype,
          buffer,
        },
        request.log,
      );

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
      return documentService.list(request.user.id);
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
      return documentService.getById(request.params.id, request.user.id);
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
      return documentService.getStatus(request.params.id, request.user.id);
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
      await documentService.remove(request.params.id, request.user.id);
      return reply.code(204).send();
    },
  );
}
