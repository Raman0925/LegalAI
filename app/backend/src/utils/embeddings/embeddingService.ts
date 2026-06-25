import { OpenAIEmbeddings } from '@langchain/openai';
import { cosineSimilarity } from './similarity.js';

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  findMostSimilar(query: number[], candidates: number[][]): { index: number; similarity: number };
}

export function createEmbeddingService(
  model: string = 'text-embedding-3-small',
  batchSize?: number,
): EmbeddingService {
  const embeddings = new OpenAIEmbeddings({
    model,
    apiKey: process.env.OPENAI_API_KEY,
    ...(batchSize ? { batchSize } : {}),
  });

  async function embed(text: string): Promise<number[]> {
    return embeddings.embedQuery(text);
  }

  async function embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    return embeddings.embedDocuments(texts);
  }

  function findMostSimilar(
    query: number[],
    candidates: number[][],
  ): { index: number; similarity: number } {
    if (candidates.length === 0) throw new Error('Candidates list cannot be empty');

    let bestIndex = -1;
    let bestSimilarity = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const similarity = cosineSimilarity(query, candidates[i]);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = i;
      }
    }

    return { index: bestIndex, similarity: bestSimilarity };
  }

  return { embed, embedBatch, findMostSimilar };
}
