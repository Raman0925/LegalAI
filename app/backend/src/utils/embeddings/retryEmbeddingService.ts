import { EmbeddingService } from './embeddingService.js';

export function withEmbeddingRetry(service: EmbeddingService, maxAttempts = 3): EmbeddingService {
  async function embedBatch(texts: string[]): Promise<number[][]> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await service.embedBatch(texts);
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 100));
        }
      }
    }
    throw lastError;
  }

  return {
    embed: service.embed,
    embedBatch,
    findMostSimilar: service.findMostSimilar,
  };
}
