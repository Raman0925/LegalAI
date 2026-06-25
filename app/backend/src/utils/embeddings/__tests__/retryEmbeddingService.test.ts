import { vi, it, expect } from 'vitest';
import { EmbeddingService } from '../embeddingService.js';
import { withEmbeddingRetry } from '../retryEmbeddingService.js';

function makeService(embedBatch: EmbeddingService['embedBatch']): EmbeddingService {
  return {
    embed: vi.fn(),
    embedBatch,
    findMostSimilar: vi.fn(),
  };
}

it('returns the result immediately when the underlying call succeeds', async () => {
  const embedBatch = vi.fn().mockResolvedValue([[0.1, 0.2]]);
  const service = withEmbeddingRetry(makeService(embedBatch), 3);

  const result = await service.embedBatch(['a']);

  expect(result).toEqual([[0.1, 0.2]]);
  expect(embedBatch).toHaveBeenCalledOnce();
});

it('retries up to maxAttempts on failure before succeeding', async () => {
  const embedBatch = vi
    .fn()
    .mockRejectedValueOnce(new Error('rate limited'))
    .mockRejectedValueOnce(new Error('rate limited'))
    .mockResolvedValueOnce([[0.3, 0.4]]);

  const service = withEmbeddingRetry(makeService(embedBatch), 3);
  const result = await service.embedBatch(['a']);

  expect(result).toEqual([[0.3, 0.4]]);
  expect(embedBatch).toHaveBeenCalledTimes(3);
});

it('throws the last error once maxAttempts is exhausted', async () => {
  const embedBatch = vi.fn().mockRejectedValue(new Error('still failing'));
  const service = withEmbeddingRetry(makeService(embedBatch), 3);

  await expect(service.embedBatch(['a'])).rejects.toThrow('still failing');
  expect(embedBatch).toHaveBeenCalledTimes(3);
});
