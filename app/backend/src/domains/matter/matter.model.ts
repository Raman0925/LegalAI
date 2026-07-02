import { DocumentRecord } from '../document/document.model.js';

export type MatterType = 'general' | 'contract' | 'litigation' | 'advisory' | 'compliance';
export type MatterStatus = 'open' | 'in_progress' | 'closed' | 'archived';
export type DraftType = 'contract' | 'letter' | 'memo' | 'clause';
export type RiskLevel = 'high' | 'medium' | 'low';

export interface MatterRecord {
  id: string;
  userId: string;
  firmId: string;
  title: string;
  clientName: string | null;
  matterType: MatterType;
  status: MatterStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatterClause {
  id: string;
  matterId: string;
  documentId: string;
  clauseType: string;
  content: string;
  riskLevel: RiskLevel | null;
  createdAt: string;
}

export interface MatterDraft {
  id: string;
  matterId: string;
  title: string;
  content: string;
  draftType: DraftType;
  createdAt: string;
  updatedAt: string;
}

export interface MatterWithDetails extends MatterRecord {
  attachedDocuments: DocumentRecord[];
  clauses: MatterClause[];
  drafts: MatterDraft[];
}
