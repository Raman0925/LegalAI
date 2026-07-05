import postgres from 'postgres';
import { EmbeddingService } from '../embeddings/embeddingService.js';
import { Reranker } from './reranker.js';
import { reciprocalRankFusion } from './rrf.js';
import { SearchResult } from '../vectorStore/types.js';

type FtsRow = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number | null;
  token_count: number | null;
  metadata: Record<string, unknown> | string;
  rank: number;
};

type VectorRow = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number | null;
  token_count: number | null;
  metadata: Record<string, unknown> | string;
  similarity: number;
};

export interface HybridRetriever {
  retrieve(
    query: string,
    userId: string,
    firmId: string,
    options?: {
      vectorCandidates?: number;
      keywordCandidates?: number;
      finalResults?: number;
    },
  ): Promise<SearchResult[]>;
}

export function createHybridRetriever(
  embeddingService: EmbeddingService,
  reranker: Reranker,
  db: postgres.Sql,
): HybridRetriever {
  async function retrieve(
    query: string,
    userId: string,
    firmId: string,
    options?: {
      vectorCandidates?: number;
      keywordCandidates?: number;
      finalResults?: number;
    },
  ): Promise<SearchResult[]> {
    if (!userId || !firmId) {
      // Fail closed — never fall back to an unscoped, cross-user search.
      throw new Error('retrieve() requires both userId and firmId; refusing unscoped search');
    }

    const vectorLimit = options?.vectorCandidates ?? 50;
    const keywordLimit = options?.keywordCandidates ?? 50;
    const finalResults = options?.finalResults ?? 5;

    const queryEmbedding = await embeddingService.embed(query);

    // Vector search scoped to the user's own documents via a subquery join.
    // (vectorStore.search()'s generic `filter` does a metadata @> containment
    // check, but ingestion never writes userId into chunk metadata, so it
    // can't be used here — this raw query scopes by the real ownership column.)
    const vectorResults = await db<VectorRow[]>`
        SELECT dc.id, dc.document_id, dc.content, dc.chunk_index, dc.token_count, dc.metadata,
               1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.user_id = ${userId} AND d.firm_id = ${firmId}
        ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${vectorLimit}
      `;

    const vectorSearchResults: SearchResult[] = vectorResults.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      content: r.content,
      similarity: Number(r.similarity),
      chunkIndex: r.chunk_index,
      tokenCount: r.token_count,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata ?? {}),
    }));

    // FTS query scoped to the user's own documents via a subquery join.
    // Without this, keyword results would leak across user boundaries.
    const ftsResults = await db<FtsRow[]>`
        SELECT dc.id, dc.document_id, dc.content, dc.chunk_index, dc.token_count, dc.metadata,
               ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', ${query})) AS rank
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.user_id = ${userId} AND d.firm_id = ${firmId}
          AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${keywordLimit}
      `;

    const keywordResults: SearchResult[] = ftsResults.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      content: r.content,
      similarity: Number(r.rank),
      chunkIndex: r.chunk_index,
      tokenCount: r.token_count,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata ?? {}),
    }));

    const fused = reciprocalRankFusion([vectorSearchResults, keywordResults]);
    if (fused.length === 0) return [];

    const reranked = await reranker.rerank(
      query,
      fused.map((f) => f.item.content),
    );

    return reranked.slice(0, finalResults).map((r) => ({
      ...fused[r.index].item,
      similarity: r.relevanceScore,
    }));
  }

  return { retrieve };
}
