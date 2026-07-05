import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { createMatterService } from './matter.service.js';
import {
  createMatterBodySchema,
  updateMatterBodySchema,
  attachDocumentBodySchema,
  createDraftBodySchema,
  matterResponseSchema,
  matterListResponseSchema,
  matterWithDetailsResponseSchema,
  matterClauseListResponseSchema,
  matterDraftResponseSchema,
} from './matter.validator.js';
import { MatterType, MatterStatus, DraftType } from './matter.model.js';
import { planLimit } from '#middlewares/plan-limits.middleware.js';
import { trackAfterResponse } from '#middlewares/usage-tracker.middleware.js';
import { requireActiveSubscription } from '#middlewares/subscription.middleware.js';

export default async function matterController(
  fastify: FastifyInstance,
  options: FastifyPluginOptions,
) {
  const matterService = createMatterService(fastify.pg);

  // POST / (create matter)
  fastify.post(
    '/',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Create a new legal matter',
        security: [{ bearerAuth: [] }],
        body: createMatterBodySchema,
        response: {
          201: matterResponseSchema,
        },
      },
      preHandler: [requireActiveSubscription],
    } as Record<string, unknown>,
    async (
      request: FastifyRequest<{
        Body: {
          title: string;
          clientName: string | null;
          matterType: MatterType;
          description: string | null;
          status?: MatterStatus;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const result = await matterService.createMatter({
        userId: request.user.id,
        firmId: request.user.firmId,
        ...request.body,
      });
      return reply.code(201).send(result);
    },
  );

  // GET / (list matters)
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Matters'],
        summary: 'List matters for authenticated user',
        security: [{ bearerAuth: [] }],
        response: {
          200: matterListResponseSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      return matterService.listMatters(request.user.firmId);
    },
  );

  // GET /:id (get matter with details)
  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Get single matter details with documents, clauses, and drafts',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: matterWithDetailsResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return matterService.getMatter(request.params.id, request.user.firmId);
    },
  );

  // PATCH /:id (update matter)
  fastify.patch(
    '/:id',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Update legal matter',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: updateMatterBodySchema,
        response: {
          200: matterResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          title?: string;
          clientName?: string | null;
          matterType?: MatterType;
          status?: MatterStatus;
          description?: string | null;
        };
      }>,
    ) => {
      return matterService.updateMatter(request.params.id, request.user.firmId, request.body);
    },
  );

  // DELETE /:id (delete matter)
  fastify.delete(
    '/:id',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Delete legal matter',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await matterService.deleteMatter(request.params.id, request.user.firmId);
      return reply.code(204).send();
    },
  );

  // POST /:id/documents (attach document)
  fastify.post(
    '/:id/documents',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Attach document to matter',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: attachDocumentBodySchema,
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { documentId: string };
      }>,
      reply: FastifyReply,
    ) => {
      await matterService.attachDocument(
        request.params.id,
        request.body.documentId,
        request.user.firmId,
      );
      return reply.code(200).send({ success: true });
    },
  );

  // DELETE /:id/documents/:docId (detach document)
  fastify.delete(
    '/:id/documents/:docId',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Detach document from matter',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'docId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            docId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string; docId: string };
      }>,
      reply: FastifyReply,
    ) => {
      await matterService.detachDocument(request.params.id, request.params.docId, request.user.firmId);
      return reply.code(204).send();
    },
  );

  // POST /:id/extract-clauses (run clause extraction)
  fastify.post(
    '/:id/extract-clauses',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Run RAG AI key clauses extraction on ready attached documents',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: matterClauseListResponseSchema,
        },
      },
      preHandler: [planLimit('ai_calls')],
      onResponse: [trackAfterResponse('ai_calls')],
    } as Record<string, unknown>,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return matterService.extractClauses(request.params.id, request.user.firmId);
    },
  );

  // POST /:id/drafts (generate draft)
  fastify.post(
    '/:id/drafts',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Generate an AI draft document for the matter',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: createDraftBodySchema,
        response: {
          201: matterDraftResponseSchema,
        },
      },
      preHandler: [planLimit('ai_calls')],
      onResponse: [trackAfterResponse('ai_calls')],
    } as Record<string, unknown>,
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          title: string;
          draftType: DraftType;
          instructions: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const result = await matterService.generateDraft(
        request.params.id,
        request.user.firmId,
        request.body.draftType,
        request.body.instructions,
        request.body.title,
      );
      return reply.code(201).send(result);
    },
  );

  // DELETE /:id/drafts/:draftId (delete draft)
  fastify.delete(
    '/:id/drafts/:draftId',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Delete generated draft',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'draftId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            draftId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string; draftId: string };
      }>,
      reply: FastifyReply,
    ) => {
      await matterService.deleteDraft(request.params.id, request.params.draftId, request.user.firmId);
      return reply.code(204).send();
    },
  );

  // GET /:id/export/pdf
  fastify.get(
    '/:id/export/pdf',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Export legal matter summary and drafts to PDF',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const result = await matterService.exportMatter(request.params.id, request.user.firmId, 'pdf');
      return reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="matter-${request.params.id}.pdf"`)
        .send(result.buffer);
    },
  );

  // GET /:id/export/docx
  fastify.get(
    '/:id/export/docx',
    {
      schema: {
        tags: ['Matters'],
        summary: 'Export legal matter summary and drafts to DOCX',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const result = await matterService.exportMatter(request.params.id, request.user.firmId, 'docx');
      return reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="matter-${request.params.id}.docx"`)
        .send(result.buffer);
    },
  );
}
