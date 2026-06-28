import { FastifyInstance } from 'fastify';
import authenticate from '#middlewares/auth.middleware.js';
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
  contractIdParamJsonSchema,
  clauseQuestionJsonSchema,
} from './contracts.schema.js';
import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { config } from '#config/index.js';

export async function contractsController(app: FastifyInstance) {

  // POST /contracts/upload — upload a contract PDF
  app.post('/upload', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const data = await request.file();

    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    if (data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'Only PDF files are accepted' });
    }

    const buffer = await data.toBuffer();
    const matterId = (request.query as { matterId?: string }).matterId;

    try {
      const contract = await uploadContract(app.supabase, {
        firmId: user.firmId || '00000000-0000-0000-0000-000000000000',
        userId: user.id,
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
    const user = request.user!;
    const contracts = await repo.getContractsByFirm(
      app.supabase,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    return reply.send({ contracts });
  });

  // GET /contracts/:contractId — get contract + fresh signed URL
  app.get('/:contractId', {
    preHandler: [authenticate],
    schema: contractIdParamJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const { contractId } = ContractIdParamSchema.parse(request.params);

    const contract = await getContractWithSignedUrl(
      app.supabase,
      contractId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!contract) return reply.status(404).send({ error: 'Contract not found' });

    return reply.send({ contract });
  });

  // GET /contracts/:contractId/annotations — get all annotations
  app.get('/:contractId/annotations', {
    preHandler: [authenticate],
    schema: contractIdParamJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const { contractId } = ContractIdParamSchema.parse(request.params);

    try {
      const annotations = await repo.getAnnotationsByContract(
        app.supabase,
        contractId,
        user.firmId || '00000000-0000-0000-0000-000000000000'
      );
      return reply.send({ annotations });
    } catch {
      return reply.status(404).send({ error: 'Contract not found' });
    }
  });

  // POST /contracts/:contractId/analyze — SSE analysis stream
  app.post('/:contractId/analyze', {
    preHandler: [authenticate],
    schema: contractIdParamJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const { contractId } = ContractIdParamSchema.parse(request.params);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      const stream = streamContractAnalysis(
        app.supabase,
        contractId,
        user.firmId || '00000000-0000-0000-0000-000000000000'
      );
      for await (const chunk of stream) {
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

  // POST /contracts/:contractId/ask — clause-level follow-up Q&A (SSE)
  app.post('/:contractId/ask', {
    preHandler: [authenticate],
    schema: clauseQuestionJsonSchema,
  }, async (request, reply) => {
    const user = request.user!;
    const { contractId } = ContractIdParamSchema.parse(request.params);
    const body = ClauseQuestionSchema.parse(request.body);

    const contract = await repo.getContractById(
      app.supabase,
      contractId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
    if (!contract) return reply.status(404).send({ error: 'Contract not found' });
    if (contract.status !== 'ready') {
      return reply.status(400).send({ error: 'Contract analysis not complete' });
    }

    // Fetch relevant pages as context
    const pages = await repo.getContractPages(
      app.supabase,
      contractId,
      user.firmId || '00000000-0000-0000-0000-000000000000'
    );
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
      ]);

      for await (const chunk of stream) {
        const text =
          typeof chunk.content === 'string'
            ? chunk.content
            : chunk.content
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join('');
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

  // GET /contracts/:contractId/export — export contract review report (PDF/DOCX)
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
    const user = request.user!;
    const { contractId } = ContractIdParamSchema.parse(request.params);
    const query = z.object({
      format: z.enum(['pdf', 'docx']).default('pdf'),
    }).parse(request.query);

    try {
      const { buffer, mimeType } = await exportContractReviewReport(
        app.supabase,
        contractId,
        user.firmId || '00000000-0000-0000-0000-000000000000',
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
