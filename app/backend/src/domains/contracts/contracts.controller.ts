import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
import { planLimit } from '#middlewares/plan-limits.middleware.js';
import { trackAfterResponse } from '#middlewares/usage-tracker.middleware.js';
import * as repo from './contracts.repository.js';
import {
  uploadContract,
  streamContractAnalysis,
  getContractWithSignedUrl,
  exportContractReviewReport,
} from './contracts.service.js';
import {
  ContractIdParamSchema,
  ClauseQuestionSchema,
  UploadContractSchema,
  contractIdParamJsonSchema,
  clauseQuestionJsonSchema,
} from './contracts.schema.js';
import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { config } from '#config/index.js';
import { createMatterRepository } from '../matter/matter.repository.js';
import { extractTextFromContent } from '../../utils/ai/langchain-helper.js';

export async function contractsController(app: FastifyInstance) {

  // POST /contracts/upload — upload a contract PDF
  app.post('/upload', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { firmId, id: userId } = request.user;
    const data = await request.file();

    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    if (data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'Only PDF files are accepted' });
    }

    const buffer = await data.toBuffer();
    const query = UploadContractSchema.parse(request.query);
    const matterId = query.matterId;

    if (matterId) {
      const matterRepo = createMatterRepository(app.pg);
      const matter = await matterRepo.findById(matterId, firmId);
      if (!matter) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Matter not found or does not belong to your firm.' });
      }
    }

    try {
      const contract = await uploadContract(app.supabase, {
        firmId,
        userId,
        matterId,
        filename: data.filename,
        buffer,
        mimeType: data.mimetype,
        fileSizeBytes: buffer.length,
      });

      return reply.status(201).send({ contract });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      return reply.status(400).send({ error: message });
    }
  });

  // GET /contracts — list all contracts for firm
  app.get('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { firmId } = request.user;
    const contracts = await repo.getContractsByFirm(app.supabase, firmId);
    return reply.send({ contracts });
  });

  // GET /contracts/:contractId — get contract + fresh signed URL
  app.get('/:contractId', {
    preHandler: [authenticate],
    schema: contractIdParamJsonSchema,
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { contractId } = ContractIdParamSchema.parse(request.params);

    const contract = await getContractWithSignedUrl(app.supabase, contractId, firmId);
    if (!contract) return reply.status(404).send({ error: 'Contract not found' });

    return reply.send({ contract });
  });

  // GET /contracts/:contractId/annotations — get all annotations
  app.get('/:contractId/annotations', {
    preHandler: [authenticate],
    schema: contractIdParamJsonSchema,
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { contractId } = ContractIdParamSchema.parse(request.params);

    try {
      const annotations = await repo.getAnnotationsByContract(app.supabase, contractId, firmId);
      return reply.send({ annotations });
    } catch {
      return reply.status(404).send({ error: 'Contract not found' });
    }
  });

  // POST /contracts/:contractId/analyze — SSE analysis stream
  // planLimit enforced before analysis starts — 429 if daily AI calls exceeded
  app.post('/:contractId/analyze', {
    preHandler: [authenticate, planLimit('ai_calls')],
    onResponse: [trackAfterResponse('ai_calls')],
    schema: contractIdParamJsonSchema,
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { contractId } = ContractIdParamSchema.parse(request.params);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const abortController = new AbortController();
    request.raw.on('close', () => abortController.abort());

    try {
      const stream = streamContractAnalysis(
        app.supabase,
        contractId,
        firmId,
        abortController.signal
      );
      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          return;
        }
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err) {
      console.error('Analysis streaming failed:', err);
      reply.raw.write(
        `data: ${JSON.stringify({ type: 'error', error: 'Analysis failed' })}\n\n`
      );
    } finally {
      reply.raw.end();
    }
  });

  // POST /contracts/:contractId/ask — clause Q&A (SSE), metered
  app.post('/:contractId/ask', {
    preHandler: [authenticate, planLimit('ai_calls')],
    onResponse: [trackAfterResponse('ai_calls')],
    schema: clauseQuestionJsonSchema,
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { contractId } = ContractIdParamSchema.parse(request.params);
    const body = ClauseQuestionSchema.parse(request.body);

    const contract = await repo.getContractById(app.supabase, contractId, firmId);
    if (!contract) return reply.status(404).send({ error: 'Contract not found' });
    if (contract.status !== 'ready') {
      return reply.status(400).send({ error: 'Contract analysis not complete' });
    }

    const pages = await repo.getContractPages(app.supabase, contractId, firmId);
    const contextPages = body.pageNumber
      ? pages.filter(p => Math.abs(p.pageNumber - body.pageNumber!) <= 2)
      : pages.slice(0, 10);

    const context = contextPages
      .map(p => `[PAGE ${p.pageNumber}]\n${p.content}`)
      .join('\n\n---\n\n');

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const abortController = new AbortController();
    request.raw.on('close', () => abortController.abort());

    try {
      const systemPrompt = `You are a legal analyst answering questions about a specific contract.
Answer based only on the contract text provided. Be precise and cite specific clauses.
Contract context:\n${context}`;

      const llm = new ChatAnthropic({
        modelName: 'claude-3-5-sonnet-20241022',
        apiKey: config.anthropicApiKey,
        maxTokens: 1024,
        temperature: 0.2,
      });

      const stream = await llm.stream([
        new SystemMessage(systemPrompt),
        new HumanMessage(body.question),
      ], { signal: abortController.signal });

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          return;
        }
        const text = extractTextFromContent(chunk.content);
        if (text) {
          reply.raw.write(
            `data: ${JSON.stringify({ type: 'text', text })}\n\n`
          );
        }
      }

      reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (err) {
      console.error('Q&A streaming failed:', err);
      reply.raw.write(
        `data: ${JSON.stringify({ type: 'error', error: 'Q&A failed' })}\n\n`
      );
    } finally {
      reply.raw.end();
    }
  });

  // GET /contracts/:contractId/export
  app.get('/:contractId/export', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['contractId'],
        properties: {
          contractId: { type: 'string', format: 'uuid' },
        },
      },
      query: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['pdf', 'docx'], default: 'pdf' },
        },
      },
    },
  }, async (request, reply) => {
    const { firmId } = request.user;
    const { contractId } = ContractIdParamSchema.parse(request.params);
    const query = z.object({
      format: z.enum(['pdf', 'docx']).default('pdf'),
    }).parse(request.query);

    try {
      const { buffer, mimeType } = await exportContractReviewReport(
        app.supabase,
        contractId,
        firmId,
        query.format
      );

      const filename = `contract-review-${contractId}.${query.format}`;
      return reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      return reply.status(400).send({ error: msg });
    }
  });
}
