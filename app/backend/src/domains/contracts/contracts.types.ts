export interface Contract {
  id: string;
  firmId: string;
  userId: string;
  matterId: string | null;
  filename: string;
  storagePath: string;
  storageUrl: string;
  fileSizeBytes: number;
  pageCount: number | null;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractPage {
  id: string;
  contractId: string;
  pageNumber: number;
  content: string;
  tokenCount: number | null;
}

export interface ContractAnnotation {
  id: string;
  contractId: string;
  pageNumber: number;
  clauseType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  clauseText: string;
  explanation: string;
  suggestion: string | null;
  bbox: BoundingBox | null;
  citationRef: string | null;
  createdAt: Date;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// SSE chunk shape for analysis progress
export interface AnalysisStreamChunk {
  type: 'progress' | 'annotation' | 'done' | 'error';
  progress?: number;           // 0–100
  message?: string;
  annotation?: ContractAnnotation;
  error?: string;
}

// Frontend-facing contract with signed URL
export interface ContractWithUrl extends Contract {
  signedUrl: string;           // fresh signed URL for PDF viewer (1hr expiry)
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const CLAUSE_TYPES = [
  'indemnification',
  'limitation_of_liability',
  'termination',
  'intellectual_property',
  'confidentiality',
  'governing_law',
  'dispute_resolution',
  'payment_terms',
  'force_majeure',
  'warranty',
  'non_compete',
  'assignment',
  'change_of_control',
  'data_protection',
  'other',
] as const;

export type ClauseType = typeof CLAUSE_TYPES[number];
