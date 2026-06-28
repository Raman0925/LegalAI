import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
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
    },
  }, async (request, reply) => {
    const user = request.user!;
    const body = CreateDocumentSchema.parse(request.body);

    const doc = await repo.createDocument(app.supabase, {
      firmId: user.firmId || '00000000-0000-0000-0000-000000000000',
      userId: user.id,
      matterId: body.matterId,
      title: body.title ?? 'Untitled Document',
      content: body.templateContent ?? { type: 'doc', content: [] },
    });

    return reply.status(201).send({ document: doc });
  });

  // GET /editor/documents — list all documents for firm
  app.get('/documents', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const { matterId } = request.query as { matterId?: string };
    const documents = await repo.getDocumentsByFirm(
      app.supabase,
      user.firmId || '00000000-0000-0000-0000-000000000000',
      matterId
    );
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
    },
  }, async (request, reply) => {
    const user = request.user!;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const doc = await repo.getDocumentById(
      app.supabase,
      documentId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!doc) return reply.status(404).send({ error: 'Document not found' });
    return reply.send({ document: doc });
  });

  // PUT /editor/documents/:documentId — auto-save document
  app.put('/documents/:documentId', {
    preHandler: [authenticate],
    schema: updateDocumentJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = UpdateDocumentSchema.parse(request.body);
    const { saveCount = 0 } = request.query as { saveCount?: number };

    await autoSaveDocument(app.supabase, {
      documentId,
      firmId: user.firmId || '00000000-0000-0000-0000-000000000000',
      userId: user.id,
      content: body.content as any,
      wordCount: body.wordCount,
      title: body.title,
      saveCount: Number(saveCount),
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
    },
  }, async (request, reply) => {
    const user = request.user!;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = SaveVersionSchema.parse(request.body);

    // Verify ownership
    const doc = await repo.getDocumentById(
      app.supabase,
      documentId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!doc) return reply.status(404).send({ error: 'Document not found' });

    const version = await repo.saveVersion(app.supabase, {
      documentId,
      firmId: user.firmId || '00000000-0000-0000-0000-000000000000',
      userId: user.id,
      content: body.content as any,
      wordCount: body.wordCount,
      label: body.label,
    });

    return reply.status(201).send({ version });
  });

  // GET /editor/documents/:documentId/versions — get all version listings
  app.get('/documents/:documentId/versions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    try {
      const versions = await repo.getVersionsByDocument(
        app.supabase,
        documentId,
        user.firmId || '00000000-0000-0000-0000-000000000000'
      );
      return reply.send({ versions });
    } catch {
      return reply.status(404).send({ error: 'Document not found' });
    }
  });

  // GET /editor/documents/:documentId/versions/:versionId — fetch version content to restore
  app.get('/documents/:documentId/versions/:versionId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const { versionId } = request.params as { versionId: string };
    const version = await repo.getVersionById(
      app.supabase,
      versionId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!version) return reply.status(404).send({ error: 'Version not found' });
    return reply.send({ version });
  });

  // POST /editor/documents/:documentId/suggest — AI inline suggestion stream (SSE)
  app.post('/documents/:documentId/suggest', {
    preHandler: [authenticate],
    schema: aiSuggestJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = AiSuggestSchema.parse(request.body);

    const doc = await repo.getDocumentById(
      app.supabase,
      documentId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!doc) return reply.status(404).send({ error: 'Document not found' });

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

  // POST /editor/documents/:documentId/rewrite — AI selection rewrite stream (SSE)
  app.post('/documents/:documentId/rewrite', {
    preHandler: [authenticate],
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
    },
  }, async (request, reply) => {
    const user = request.user!;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = AiRewriteSchema.parse(request.body);

    const doc = await repo.getDocumentById(
      app.supabase,
      documentId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!doc) return reply.status(404).send({ error: 'Document not found' });

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
    },
  }, async (request, reply) => {
    const user = request.user!;
    const { documentId } = DocumentIdParamSchema.parse(request.params);
    const body = ExportSchema.parse(request.body);

    try {
      const { buffer, filename, mimeType } = await exportDocumentById(
        app.supabase,
        documentId,
        user.firmId || '00000000-0000-0000-0000-000000000000',
        body.format
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
