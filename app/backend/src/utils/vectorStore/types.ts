export interface InsertChunkParams {
  documentId: string;
  content: string;
  embedding: number[];
  chunkIndex?: number;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
  chunkIndex: number | null;
  tokenCount: number | null;
  metadata: Record<string, unknown>;
}

export interface SearchParams {
  embedding: number[];
  limit?: number;
  minSimilarity?: number;
  filter?: Record<string, unknown>;
}
