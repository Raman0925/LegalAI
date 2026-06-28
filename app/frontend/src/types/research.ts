export interface ResearchSession {
  id: string;
  firmId: string;
  userId: string;
  matterId: string | null;
  title: string;
  query: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ResearchMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ResearchCitation[];
  createdAt: string;
}

export interface ResearchCitation {
  id: string;
  messageId: string;
  sessionId: string;
  sourceDocumentId: string | null;
  documentName: string;
  pageNumber: number | null;
  chunkPreview: string;
  relevanceScore: number;
  citationIndex: number;
}

export interface ResearchStreamChunk {
  type: 'text' | 'citation' | 'done' | 'error';
  text?: string;
  citation?: ResearchCitation;
  error?: string;
}
