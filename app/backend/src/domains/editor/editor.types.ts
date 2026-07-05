export interface JSONContent {
  type?: string;
  attrs?: Record<string, any>;
  content?: JSONContent[];
  marks?: Array<{
    type: string;
    attrs?: Record<string, any>;
    [key: string]: any;
  }>;
  text?: string;
  [key: string]: any;
}

export interface LegalDocument {
  id: string;
  firmId: string;
  userId: string;
  matterId: string | null;
  title: string;
  content: JSONContent;
  wordCount: number;
  saveCount: number;
  version: number;
  status: 'draft' | 'review' | 'final' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  firmId: string;
  userId: string;
  content: JSONContent;
  wordCount: number;
  label: string | null;
  createdAt: Date;
}

// SSE chunk shape for AI suggestion stream
export interface SuggestionStreamChunk {
  type: 'text' | 'done' | 'error';
  text?: string;
  error?: string;
}

// AI rewrite tones
export const REWRITE_TONES = [
  'formal',
  'simplified',
  'aggressive',
  'conciliatory',
  'neutral',
] as const;

export type RewriteTone = typeof REWRITE_TONES[number];

export type ExportFormat = 'pdf' | 'docx';
