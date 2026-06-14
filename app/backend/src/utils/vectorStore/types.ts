export interface InsertChunkParams {
  documentId: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface SearchParams {
  embedding: number[];
  limit?: number;
  minSimilarity?: number;
  filter?: Record<string, unknown>;
}