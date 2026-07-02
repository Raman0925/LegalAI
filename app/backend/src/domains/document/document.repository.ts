import pg from 'pg';
import { DocumentRecord, DocumentStatus } from './document.model.js';
import { FileType } from './document.constant.js';

interface DocumentRow {
  id: string;
  user_id: string;
  firm_id: string;
  name: string;
  file_type: FileType;
  storage_path: string;
  size_bytes: number | null;
  status: DocumentStatus;
  chunk_count: number;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    firmId: row.firm_id,
    name: row.name,
    fileType: row.file_type,
    storagePath: row.storage_path,
    sizeBytes: row.size_bytes,
    status: row.status,
    chunkCount: row.chunk_count,
    errorMsg: row.error_msg,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DocumentRepository {
  create(params: {
    id: string;
    userId: string;
    firmId: string;
    name: string;
    fileType: FileType;
    storagePath: string;
    sizeBytes: number | null;
  }): Promise<DocumentRecord>;
  findById(id: string, firmId: string): Promise<DocumentRecord | null>;
  listByFirm(firmId: string): Promise<DocumentRecord[]>;
  updateStatus(
    id: string,
    status: DocumentStatus,
    fields?: { chunkCount?: number; errorMsg?: string | null },
  ): Promise<void>;
  delete(id: string, firmId: string): Promise<DocumentRecord | null>;
}

export function createDocumentRepository(pgPool: pg.Pool): DocumentRepository {
  async function create(params: {
    id: string;
    userId: string;
    firmId: string;
    name: string;
    fileType: FileType;
    storagePath: string;
    sizeBytes: number | null;
  }): Promise<DocumentRecord> {
    const result = await pgPool.query<DocumentRow>(
      `INSERT INTO documents (id, user_id, firm_id, name, file_type, storage_path, size_bytes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        params.id,
        params.userId,
        params.firmId,
        params.name,
        params.fileType,
        params.storagePath,
        params.sizeBytes,
      ],
    );
    return mapRow(result.rows[0]);
  }

  async function findById(id: string, firmId: string): Promise<DocumentRecord | null> {
    const result = await pgPool.query<DocumentRow>(
      `SELECT * FROM documents WHERE id = $1 AND firm_id = $2`,
      [id, firmId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async function listByFirm(firmId: string): Promise<DocumentRecord[]> {
    const result = await pgPool.query<DocumentRow>(
      `SELECT * FROM documents WHERE firm_id = $1 ORDER BY created_at DESC`,
      [firmId],
    );
    return result.rows.map(mapRow);
  }

  async function updateStatus(
    id: string,
    status: DocumentStatus,
    fields?: { chunkCount?: number; errorMsg?: string | null },
  ): Promise<void> {
    await pgPool.query(
      `UPDATE documents
       SET status      = $2,
           chunk_count = COALESCE($3, chunk_count),
           error_msg   = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE error_msg END
       WHERE id = $1`,
      [id, status, fields?.chunkCount ?? null, fields?.errorMsg ?? null],
    );
  }

  async function deleteDocument(id: string, firmId: string): Promise<DocumentRecord | null> {
    const result = await pgPool.query<DocumentRow>(
      `DELETE FROM documents WHERE id = $1 AND firm_id = $2 RETURNING *`,
      [id, firmId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  return {
    create,
    findById,
    listByFirm,
    updateStatus,
    delete: deleteDocument,
  };
}
