import pg from 'pg';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { FastifyError, FastifyBaseLogger } from 'fastify';
import { createDocumentRepository } from './document.repository.js';
import { detectFileType, sanitizeFilename } from './document.util.js';
import { DocumentRecord } from './document.model.js';
import {
  CHUNK_MAX_TOKENS,
  CHUNK_OVERLAP_TOKENS,
  EMBED_RETRY_ATTEMPTS,
  STORAGE_BUCKET,
} from './document.constant.js';
import { createChunker } from '../../utils/rag/chunker.js';
import { createEmbeddingService } from '../../utils/embeddings/embeddingService.js';
import { withEmbeddingRetry } from '../../utils/embeddings/retryEmbeddingService.js';
import { createVectorStore } from '../../utils/vectorStore/vectorStore.js';
import { createIngestionPipeline } from '../../utils/rag/ingestion-pipeline.js';
import { parseFile } from '../../utils/rag/fileParser.js';
import { createStorageService } from '../../utils/storage/storageService.js';
import { createSupabaseAdminClient } from '../../utils/storage/supabaseClient.js';

// Module-level singleton init, mirroring chat.service.ts: a dedicated postgres.js
// connection is used for vector ops, separate from the fastify-decorated pg.Pool
// used for relational CRUD below.
const db = postgres(process.env.DATABASE_URL || '', {
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

const vectorStore = createVectorStore(db);
const embeddingService = withEmbeddingRetry(
  createEmbeddingService('text-embedding-3-small', 100),
  EMBED_RETRY_ATTEMPTS,
);
const chunker = createChunker({ maxTokens: CHUNK_MAX_TOKENS, overlapTokens: CHUNK_OVERLAP_TOKENS });
const ingestionPipeline = createIngestionPipeline(chunker, embeddingService, vectorStore);
const storage = createStorageService(createSupabaseAdminClient(), STORAGE_BUCKET);

// firmId is '' when the caller's profile has no firm yet (see auth.middleware.ts) —
// fail closed with 402 rather than let an empty string reach a firm_id UUID column.
function assertFirm(firmId: string): void {
  if (!firmId) {
    const error = new Error('Firm not configured. Please complete onboarding.') as FastifyError;
    error.statusCode = 402;
    throw error;
  }
}

export interface UploadedFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface DocumentService {
  upload(
    userId: string,
    firmId: string,
    file: UploadedFile,
    log: FastifyBaseLogger,
  ): Promise<{ documentId: string; status: 'pending' }>;
  list(firmId: string): Promise<DocumentRecord[]>;
  getById(id: string, firmId: string): Promise<DocumentRecord>;
  getStatus(
    id: string,
    firmId: string,
  ): Promise<{ status: string; chunkCount: number; errorMsg: string | null }>;
  remove(id: string, firmId: string): Promise<void>;
}

export function createDocumentService(pgPool: pg.Pool): DocumentService {
  const repository = createDocumentRepository(pgPool);

  async function ingest(doc: DocumentRecord, buffer: Buffer): Promise<void> {
    try {
      await repository.updateStatus(doc.id, 'processing');
      const text = await parseFile(buffer, doc.fileType);
      const result = await ingestionPipeline.ingest({ id: doc.id, content: text });
      await repository.updateStatus(doc.id, 'ready', { chunkCount: result.chunksCreated });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown ingestion error';
      await repository.updateStatus(doc.id, 'failed', { errorMsg: message });
    }
  }

  async function upload(
    userId: string,
    firmId: string,
    file: UploadedFile,
    log: FastifyBaseLogger,
  ): Promise<{ documentId: string; status: 'pending' }> {
    assertFirm(firmId);
    const fileType = detectFileType(file.mimetype, file.filename);
    const documentId = randomUUID();
    const storagePath = `${userId}/${documentId}/${sanitizeFilename(file.filename)}`;

    await storage.upload(storagePath, file.buffer, file.mimetype);

    const doc = await repository.create({
      id: documentId,
      userId,
      firmId,
      name: file.filename,
      fileType,
      storagePath,
      sizeBytes: file.buffer.length,
    });

    // Fire-and-forget: the route returns 202 immediately, ingestion runs in the background.
    // The .catch ensures any throw that escapes the ingest() try/catch (e.g. during
    // repository.updateStatus) is logged rather than crashing the process.
    ingest(doc, file.buffer).catch((err) => {
      log.error({ err, documentId: doc.id }, 'Unhandled ingestion failure');
    });

    return { documentId: doc.id, status: 'pending' };
  }

  async function list(firmId: string): Promise<DocumentRecord[]> {
    assertFirm(firmId);
    return repository.listByFirm(firmId);
  }

  async function getById(id: string, firmId: string): Promise<DocumentRecord> {
    assertFirm(firmId);
    const doc = await repository.findById(id, firmId);
    if (!doc) {
      const error = new Error('Document not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }
    return doc;
  }

  async function getStatus(
    id: string,
    firmId: string,
  ): Promise<{ status: string; chunkCount: number; errorMsg: string | null }> {
    const doc = await getById(id, firmId);
    return { status: doc.status, chunkCount: doc.chunkCount, errorMsg: doc.errorMsg };
  }

  async function remove(id: string, firmId: string): Promise<void> {
    const doc = await getById(id, firmId);
    await storage.remove(doc.storagePath);
    await repository.delete(id, firmId);
  }

  return { upload, list, getById, getStatus, remove };
}
