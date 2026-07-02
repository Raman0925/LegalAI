import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
import { planLimit } from '#middlewares/plan-limits.middleware.js';
import { trackAfterResponse } from '#middlewares/usage-tracker.middleware.js';
import * as repo from './editor.repository.js';
import {
  autoSaveDocument,
  streamAiSuggestion,
  streamAiRewrite,
  exportDocumentById,
} from './editor.service.js';
import {
  CreateDocumentSchema,
  UpdateDocumentSchema,
  SaveVersionSchema,
  AiSuggestSchema,
  AiRewriteSchema,
  ExportSchema,
  DocumentIdParamSchema,
  updateDocumentJsonSchema,
  aiSuggestJsonSchema,
  errorResponseSchema,
  legalDocumentSchema,
  documentVersionSchema,
} from './editor.schema.js';

export async function editorController(app: FastifyInstance) {

  // POST /editor/documents — create a new document
  app.post('/documents', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          matterId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            document: legalDocumentSchema,
          },
          required: ['document'],
        },
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId, id: userId } = request.user;
    const body = CreateDocumentSchema.parse(request.body);

    const doc = await repo.createDocument(app.supabase, {
      firmId,
      userId,
      matterId: body.matterId,
      title: body.title ?? 'Untitled Document',
      content: body.templateContent ?? { type: 'doc', content: [] },
    });

    return reply.status(201).send({ document: doc });
  });

  // GET /editor/documents — list all documents for firm
  app.get('/documents', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            documents: {
              type: 'array',
              items: legalDocumentSchema,
            },
          },
          required: ['documents'],
        },
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { matterId } = request.query as { matterId?: string };
    const documents = await repo.getDocumentsByFirm(app.supabase, firmId, matterId);
    return reply.send({ documents });
  });

  // GET /editor/documents/:documentId — get document details
  app.get('/documents/:documentId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['documentId'],
        properties: { documentId: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            document: legalDocumentSchema,
          },
          required: ['document'],
        },
        404: errorResponseSchema,
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const doc = await repo.getDocumentById(app.supabase, documentId, firmId);
    if (!doc) return reply.status(404).send({ error: 'Document not found', message: 'Document not found' });
    return reply.send({ document: doc });
  });

  // PUT /editor/documents/:documentId — auto-save (debounced from frontend)
  app.put('/documents/:documentId', {
    preHandler: [authenticate],
    schema: {
      ...updateDocumentJsonSchema,
      response: {
        200: { type: 'object', properties: { saved: { type: 'boolean' } }, required: ['saved'] },
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId, id: userId } = request.user;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = UpdateDocumentSchema.parse(request.body);

    await autoSaveDocument(app.supabase, {
      documentId,
      firmId,
      userId,
      content: body.content as never,
      wordCount: body.wordCount,
      title: body.title,
    });

    return reply.send({ saved: true });
  });

  // POST /editor/documents/:documentId/versions — create a checkpoint version snapshot
  app.post('/documents/:documentId/versions', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['content', 'wordCount'],
        properties: {
          content: { type: 'object' },
          wordCount: { type: 'integer' },
          label: { type: 'string', maxLength: 200 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            version: documentVersionSchema,
          },
          required: ['version'],
        },
        404: errorResponseSchema,
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId, id: userId } = request.user;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = SaveVersionSchema.parse(request.body);

    const doc = await repo.getDocumentById(app.supabase, documentId, firmId);
    if (!doc) return reply.status(404).send({ error: 'Document not found', message: 'Document not found' });

    const version = await repo.saveVersion(app.supabase, {
      documentId,
      firmId,
      userId,
      content: body.content as never,
      wordCount: body.wordCount,
      label: body.label,
    });

    return reply.status(201).send({ version });
  });

  // GET /editor/documents/:documentId/versions
  app.get('/documents/:documentId/versions', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: { type: 'object', properties: { versions: { type: 'array', items: documentVersionSchema } }, required: ['versions'] },
        404: errorResponseSchema,
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    try {
      const versions = await repo.getVersionsByDocument(app.supabase, documentId, firmId);
      return reply.send({ versions });
    } catch {
      return reply.status(404).send({ error: 'Document not found', message: 'Document not found' });
    }
  });

  // GET /editor/documents/:documentId/versions/:versionId
  app.get('/documents/:documentId/versions/:versionId', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: { type: 'object', properties: { version: documentVersionSchema }, required: ['version'] },
        404: errorResponseSchema,
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { versionId } = request.params as { versionId: string };
    const version = await repo.getVersionById(app.supabase, versionId, firmId);
    if (!version) return reply.status(404).send({ error: 'Version not found', message: 'Version not found' });
    return reply.send({ version });
  });

  // POST /editor/documents/:documentId/suggest — AI suggestion (SSE), metered
  app.post('/documents/:documentId/suggest', {
    preHandler: [authenticate, planLimit('ai_calls')],
    onResponse: [trackAfterResponse('ai_calls')],
    schema: {
      ...aiSuggestJsonSchema,
      response: {
        200: {
          type: 'string',
          description: 'Event Stream',
        },
        404: errorResponseSchema,
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = AiSuggestSchema.parse(request.body);

    const doc = await repo.getDocumentById(app.supabase, documentId, firmId);
    if (!doc) return reply.status(404).send({ error: 'Document not found', message: 'Document not found' });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const abortController = new AbortController();
    request.raw.on('close', () => abortController.abort());

    try {
      const stream = streamAiSuggestion(
        body.precedingText,
        body.documentTitle,
        abortController.signal
      );
      for await (const chunk of stream) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err) {
      console.error('AI suggestion stream failed:', err);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: 'Suggestion failed' })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  // POST /editor/documents/:documentId/rewrite — AI rewrite (SSE), metered
  app.post('/documents/:documentId/rewrite', {
    preHandler: [authenticate, planLimit('ai_calls')],
    onResponse: [trackAfterResponse('ai_calls')],
    schema: {
      body: {
        type: 'object',
        required: ['selectedText', 'tone', 'documentTitle'],
        properties: {
          selectedText: { type: 'string', minLength: 1, maxLength: 5000 },
          tone: { type: 'string', enum: ['formal', 'simplified', 'aggressive', 'conciliatory', 'neutral'] },
          documentTitle: { type: 'string', maxLength: 300 },
        },
      },
      response: {
        200: {
          type: 'string',
          description: 'Event Stream',
        },
        404: errorResponseSchema,
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = AiRewriteSchema.parse(request.body);

    const doc = await repo.getDocumentById(app.supabase, documentId, firmId);
    if (!doc) return reply.status(404).send({ error: 'Document not found', message: 'Document not found' });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const abortController = new AbortController();
    request.raw.on('close', () => abortController.abort());

    try {
      const stream = streamAiRewrite(
        body.selectedText,
        body.tone,
        body.documentTitle,
        abortController.signal
      );
      for await (const chunk of stream) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err) {
      console.error('AI rewrite stream failed:', err);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: 'Rewrite failed' })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  // POST /editor/documents/:documentId/export — export document as PDF or DOCX binary
  app.post('/documents/:documentId/export', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['format'],
        properties: {
          format: { type: 'string', enum: ['pdf', 'docx'] },
        },
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'Exported file',
        },
        400: errorResponseSchema,
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = ExportSchema.parse(request.body);

    try {
      const { buffer, filename, mimeType } = await exportDocumentById(
        app.supabase, documentId, firmId, body.format
      );

      return reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      return reply.status(400).send({ error: message });
    }
  });
}
