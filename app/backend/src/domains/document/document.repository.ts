import pg from 'pg';
import { DocumentRecord, DocumentStatus } from './document.model.js';
import { FileType } from './document.constant.js';

interface DocumentRow {
  id: string;
  user_id: string;
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
    name: string;
    fileType: FileType;
    storagePath: string;
    sizeBytes: number | null;
  }): Promise<DocumentRecord>;
  findById(id: string, userId: string): Promise<DocumentRecord | null>;
  listByUser(userId: string): Promise<DocumentRecord[]>;
  updateStatus(
    id: string,
    status: DocumentStatus,
    fields?: { chunkCount?: number; errorMsg?: string | null },
  ): Promise<void>;
  delete(id: string, userId: string): Promise<DocumentRecord | null>;
}

export function createDocumentRepository(pgPool: pg.Pool): DocumentRepository {
  async function create(params: {
    id: string;
    userId: string;
    name: string;
    fileType: FileType;
    storagePath: string;
    sizeBytes: number | null;
  }): Promise<DocumentRecord> {
    const result = await pgPool.query<DocumentRow>(
      `INSERT INTO documents (id, user_id, name, file_type, storage_path, size_bytes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        params.id,
        params.userId,
        params.name,
        params.fileType,
        params.storagePath,
        params.sizeBytes,
      ],
    );
    return mapRow(result.rows[0]);
  }

  async function findById(id: string, userId: string): Promise<DocumentRecord | null> {
    const result = await pgPool.query<DocumentRow>(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async function listByUser(userId: string): Promise<DocumentRecord[]> {
    const result = await pgPool.query<DocumentRow>(
      `SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
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

  async function deleteDocument(id: string, userId: string): Promise<DocumentRecord | null> {
    const result = await pgPool.query<DocumentRow>(
      `DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  return {
    create,
    findById,
    listByUser,
    updateStatus,
    delete: deleteDocument,
  };
}
