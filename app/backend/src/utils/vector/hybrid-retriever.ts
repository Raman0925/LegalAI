import postgres from 'postgres';
import { VectorStore } from '../vectorStore/vectorStore.js';
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

export interface HybridRetriever {
  retrieve(
    query: string,
    options?: {
      userId?: string;
      vectorCandidates?: number;
      keywordCandidates?: number;
      finalResults?: number;
    },
  ): Promise<SearchResult[]>;
}

export function createHybridRetriever(
  vectorStore: VectorStore,
  embeddingService: EmbeddingService,
  reranker: Reranker,
  db: postgres.Sql,
): HybridRetriever {
  async function retrieve(
    query: string,
    options?: {
      userId?: string;
      vectorCandidates?: number;
      keywordCandidates?: number;
      finalResults?: number;
    },
  ): Promise<SearchResult[]> {
    const vectorLimit = options?.vectorCandidates ?? 50;
    const keywordLimit = options?.keywordCandidates ?? 50;
    const finalResults = options?.finalResults ?? 5;
    const userId = options?.userId;

    const queryEmbedding = await embeddingService.embed(query);
    const vectorResults = await vectorStore.search({
      embedding: queryEmbedding,
      limit: vectorLimit,
      ...(userId ? { filter: { userId } } : {}),
    });

    // FTS query scoped to the user's own documents via a subquery join.
    // Without this, keyword results would leak across user boundaries.
    const ftsResults = await (userId
      ? db<FtsRow[]>`
          SELECT dc.id, dc.document_id, dc.content, dc.chunk_index, dc.token_count, dc.metadata,
                 ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', ${query})) AS rank
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.document_id
          WHERE d.user_id = ${userId}
            AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', ${query})
          ORDER BY rank DESC
          LIMIT ${keywordLimit}
        `
      : db<FtsRow[]>`
          SELECT id, document_id, content, chunk_index, token_count, metadata,
                 ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${query})) AS rank
          FROM document_chunks
          WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
          ORDER BY rank DESC
          LIMIT ${keywordLimit}
        `);

    const keywordResults: SearchResult[] = ftsResults.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      content: r.content,
      similarity: Number(r.rank),
      chunkIndex: r.chunk_index,
      tokenCount: r.token_count,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata ?? {}),
    }));

    const fused = reciprocalRankFusion([vectorResults, keywordResults]);
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
