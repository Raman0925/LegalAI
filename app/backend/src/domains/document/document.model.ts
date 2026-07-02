import { FileType } from './document.constant.js';

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface DocumentRecord {
  id: string;
  userId: string;
  firmId: string;
  name: string;
  fileType: FileType;
  storagePath: string;
  sizeBytes: number | null;
  status: DocumentStatus;
  chunkCount: number;
  errorMsg: string | null;
  createdAt: string;
  updatedAt: string;
}
