import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
import { planLimit } from '#middlewares/plan-limits.middleware.js';
import { trackAfterResponse } from '#middlewares/usage-tracker.middleware.js';
import * as repo from './editor.repository.js';
import {
  streamAiSuggestion,
  streamAiRewrite,
  exportDocumentById,
} from './editor.service.js';
import {
  CreateDocumentSchema,
  UpdateDocumentSchema,
  GetDocumentsQuerySchema,
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
import { createMatterRepository } from '../matter/matter.repository.js';
import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';
import { config } from '#config/index.js';
import { extractTextFromContent } from '../../utils/ai/langchain-helper.js';

export async function editorController(app: FastifyInstance) {

  // POST /editor/audit — text review audit (JSON)
  app.post('/audit', {
    preHandler: [authenticate, planLimit('ai_calls')],
    onResponse: [trackAfterResponse('ai_calls')],
  }, async (request, reply) => {
    const body = z.object({ prompt: z.string() }).parse(request.body);

    try {
      const llm = new ChatAnthropic({
        modelName: 'claude-3-5-sonnet-20241022',
        apiKey: config.anthropicApiKey,
        maxTokens: 2000,
        temperature: 0.2,
      });

      const response = await llm.invoke([
        new HumanMessage(body.prompt),
      ]);

      const text = extractTextFromContent(response.content);
      return reply.send({ text });
    } catch (err: any) {
      console.error('Audit review failed:', err);
      return reply.status(400).send({ error: 'Audit failed', message: err.message });
    }
  });

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

    if (body.matterId) {
      const matterRepo = createMatterRepository(app.pg);
      const matter = await matterRepo.findById(body.matterId, firmId);
      if (!matter) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Matter not found or does not belong to your firm.' });
      }
    }

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
    const { matterId } = GetDocumentsQuerySchema.parse(request.query);

    if (matterId) {
      const matterRepo = createMatterRepository(app.pg);
      const matter = await matterRepo.findById(matterId, firmId);
      if (!matter) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Matter not found or does not belong to your firm.' });
      }
    }

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
        200: {
          type: 'object',
          properties: {
            saved: { type: 'boolean' },
            version: { type: 'integer' },
          },
          required: ['saved', 'version'],
        },
        409: errorResponseSchema,
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firmId, id: userId } = request.user;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = UpdateDocumentSchema.parse(request.body);

    try {
      const updatedDoc = await repo.updateDocument(
        app.supabase,
        documentId,
        firmId,
        {
          title: body.title,
          content: body.content as never,
          wordCount: body.wordCount,
          status: body.status,
        },
        body.version
      );

      // Save a version snapshot every 10 auto-saves
      if (updatedDoc.saveCount > 0 && updatedDoc.saveCount % 10 === 0) {
        await repo.saveVersion(app.supabase, {
          documentId,
          firmId,
          userId,
          content: body.content as never,
          wordCount: body.wordCount,
          label: `Auto-snapshot #${updatedDoc.saveCount}`,
        });
      }

      return reply.send({ saved: true, version: updatedDoc.version });
    } catch (err: any) {
      if (err.message === 'CONCURRENCY_CONFLICT') {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'The document has been modified by another user or session. Please reload and merge your changes.',
        });
      }
      return reply.status(400).send({ error: 'Update failed', message: err.message });
    }
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
