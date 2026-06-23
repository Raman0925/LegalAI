import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEmbeddingService } from '../embeddingService.js';
import { OpenAIEmbeddings } from '@langchain/openai';

vi.mock('@langchain/openai', () => {
  return {
    OpenAIEmbeddings: vi.fn().mockImplementation(() => {
      return {
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        embedDocuments: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]),
      };
    }),
  };
});

describe('EmbeddingService', () => {
  const model = 'text-embedding-3-small';
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it('should call embedQuery when calling embed', async () => {
    const mockEmbedQuery = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
    vi.mocked(OpenAIEmbeddings).mockImplementation(() => {
      return {
        embedQuery: mockEmbedQuery,
      } as any;
    });

    const service = createEmbeddingService(model);
    const result = await service.embed('Hello world');

    expect(mockEmbedQuery).toHaveBeenCalledWith('Hello world');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('should call embedDocuments when calling embedBatch', async () => {
    const mockEmbedDocuments = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
    vi.mocked(OpenAIEmbeddings).mockImplementation(() => {
      return {
        embedDocuments: mockEmbedDocuments,
      } as any;
    });

    const service = createEmbeddingService(model);
    const result = await service.embedBatch(['first', 'second']);

    expect(mockEmbedDocuments).toHaveBeenCalledWith(['first', 'second']);
    expect(result).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
  });

  it('should correctly find the index of the candidate vector most similar to the query', () => {
    const service = createEmbeddingService(model);
    const query = [1, 0, 0];
    const candidates = [
      [0, 1, 0], // Orthogonal (similarity 0)
      [0.8, 0.6, 0], // High similarity (0.8)
      [-1, 0, 0], // Opposite (similarity -1)
    ];

    const result = service.findMostSimilar(query, candidates);
    expect(result.index).toBe(1);
    expect(result.similarity).toBeCloseTo(0.8, 5);
  });
});
