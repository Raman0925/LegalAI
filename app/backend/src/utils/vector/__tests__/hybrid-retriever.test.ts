import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createHybridRetriever } from '../hybrid-retriever.js';
import { EmbeddingService } from '../../embeddings/embeddingService.js';
import { Reranker } from '../reranker.js';

describe('HybridRetriever', () => {
  let embeddingService: EmbeddingService;
  let reranker: Reranker;
  let mockDb: any;

  beforeEach(() => {
    embeddingService = {
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
      findMostSimilar: vi.fn().mockReturnValue({ index: 0, similarity: 1 }),
    };
    reranker = {
      rerank: vi.fn().mockImplementation(async (_query: string, documents: string[]) =>
        documents.map((_, index) => ({ index, relevanceScore: 1 - index * 0.1, content: '' })),
      ),
    };
  });

  it('fails closed and never runs a query when userId or firmId is missing', async () => {
    mockDb = vi.fn();
    const retriever = createHybridRetriever(embeddingService, reranker, mockDb);

    await expect(retriever.retrieve('query', '', 'firm-a')).rejects.toThrow(/userId/i);
    await expect(retriever.retrieve('query', 'user-a', '')).rejects.toThrow(/userId/i);
    expect(mockDb).not.toHaveBeenCalled();
  });

  it('scopes both vector and keyword results to the requesting user and firm only', async () => {
    // Fake rows keyed by which user_id the query was scoped to — a stand-in
    // for a real per-user document boundary in document_chunks/documents.
    const rowsForUser: Record<string, any[]> = {
      'user-a': [
        {
          id: 'chunk-a1',
          document_id: 'doc-a1',
          content: 'user A private content',
          chunk_index: 0,
          token_count: 10,
          metadata: {},
          similarity: 0.9,
          rank: 0.9,
        },
      ],
      'user-b': [
        {
          id: 'chunk-b1',
          document_id: 'doc-b1',
          content: 'user B private content',
          chunk_index: 0,
          token_count: 10,
          metadata: {},
          similarity: 0.9,
          rank: 0.9,
        },
      ],
    };

    mockDb = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const userId = values.find((v) => v === 'user-a' || v === 'user-b') as string | undefined;
      return Promise.resolve(userId ? rowsForUser[userId] : []);
    });

    const retriever = createHybridRetriever(embeddingService, reranker, mockDb);

    const resultsA = await retriever.retrieve('query', 'user-a', 'firm-a');
    expect(resultsA.map((r) => r.documentId)).toEqual(['doc-a1']);
    expect(resultsA.some((r) => r.content.includes('user B'))).toBe(false);

    const resultsB = await retriever.retrieve('query', 'user-b', 'firm-b');
    expect(resultsB.map((r) => r.documentId)).toEqual(['doc-b1']);
    expect(resultsB.some((r) => r.content.includes('user A'))).toBe(false);
  });
});
