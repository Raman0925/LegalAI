import postgres from 'postgres';
import { InsertChunkParams, SearchParams, SearchResult } from './types.js';

type ChunkRow = {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
  chunk_index: number | null;
  token_count: number | null;
  metadata: Record<string, unknown> | string;
};

export interface VectorStore {
  insert(params: InsertChunkParams): Promise<string>;
  insertBatch(chunks: InsertChunkParams[]): Promise<string[]>;
  search(params: SearchParams): Promise<SearchResult[]>;
  deleteByDocumentId(documentId: string): Promise<number>;
}

export function createVectorStore(db: postgres.Sql): VectorStore {
  async function insert(params: InsertChunkParams): Promise<string> {
    const [result] = await db<{ id: string }[]>`
      INSERT INTO document_chunks (document_id, chunk_index, content, embedding, token_count, metadata)
      VALUES (
        ${params.documentId},
        ${params.chunkIndex ?? 0},
        ${params.content},
        ${params.embedding}::vector,
        ${params.tokenCount ?? null},
        ${params.metadata ? db.json(params.metadata as any) : null}
      )
      RETURNING id
    `;
    if (!result) {
      throw new Error('Failed to insert chunk');
    }
    return result.id;
  }

  async function insertBatch(chunks: InsertChunkParams[]): Promise<string[]> {
    if (chunks.length === 0) return [];

    const rows = chunks.map((chunk, idx) => ({
      document_id: chunk.documentId,
      chunk_index: chunk.chunkIndex ?? idx,
      content: chunk.content,
      embedding: `[${chunk.embedding.join(',')}]`,
      token_count: chunk.tokenCount ?? null,
      metadata: chunk.metadata ? db.json(chunk.metadata as any) : null,
    }));

    const results = await db<{ id: string }[]>`
      INSERT INTO document_chunks ${db(rows)}
      RETURNING id
    `;

    return results.map((r) => r.id);
  }

  async function search(params: SearchParams): Promise<SearchResult[]> {
    const limit = params.limit ?? 10;
    const minSimilarity = params.minSimilarity ?? 0.0;
    const filter = params.filter;

    const results = await db<ChunkRow[]>`
      SELECT id, document_id, content, similarity, chunk_index, token_count, metadata
      FROM (
        SELECT id, document_id AS "document_id", content, 1 - (embedding <=> ${params.embedding}::vector) AS similarity, chunk_index, token_count, metadata
        FROM document_chunks
        WHERE 1 = 1
        ${filter ? db`AND metadata @> ${JSON.stringify(filter)}::jsonb` : db``}
      ) sub
      WHERE similarity >= ${minSimilarity}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      content: r.content,
      similarity: Number(r.similarity),
      chunkIndex: r.chunk_index,
      tokenCount: r.token_count,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata ?? {}),
    }));
  }

  async function deleteByDocumentId(documentId: string): Promise<number> {
    const result = await db`
      DELETE FROM document_chunks
      WHERE document_id = ${documentId}
    `;
    return result.count;
  }

  return {
    insert,
    insertBatch,
    search,
    deleteByDocumentId,
  };
}
