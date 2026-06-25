import pg from 'pg';
import {
  MatterRecord,
  MatterClause,
  MatterDraft,
  MatterWithDetails,
  MatterType,
  MatterStatus,
  DraftType,
  RiskLevel,
} from './matter.model.js';
import { DocumentRecord } from '../document/document.model.js';

interface MatterRow {
  id: string;
  user_id: string;
  title: string;
  client_name: string | null;
  matter_type: MatterType;
  status: MatterStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
  document_count?: number;
}

interface ClauseRow {
  id: string;
  matter_id: string;
  document_id: string;
  clause_type: string;
  content: string;
  risk_level: RiskLevel | null;
  created_at: string;
}

interface DraftRow {
  id: string;
  matter_id: string;
  title: string;
  content: string;
  draft_type: DraftType;
  created_at: string;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  user_id: string;
  name: string;
  file_type: 'pdf' | 'docx' | 'txt' | 'image';
  storage_path: string;
  size_bytes: number | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  chunk_count: number;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
}

function mapMatterRow(row: MatterRow): MatterRecord & { documentCount?: number } {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    clientName: row.client_name,
    matterType: row.matter_type,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentCount: row.document_count !== undefined ? Number(row.document_count) : undefined,
  };
}

function mapClauseRow(row: ClauseRow): MatterClause {
  return {
    id: row.id,
    matterId: row.matter_id,
    documentId: row.document_id,
    clauseType: row.clause_type,
    content: row.content,
    riskLevel: row.risk_level,
    createdAt: row.created_at,
  };
}

function mapDraftRow(row: DraftRow): MatterDraft {
  return {
    id: row.id,
    matterId: row.matter_id,
    title: row.title,
    content: row.content,
    draftType: row.draft_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocumentRow(row: DocumentRow): DocumentRecord {
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

export interface MatterRepository {
  create(params: {
    userId: string;
    title: string;
    clientName: string | null;
    matterType: MatterType;
    description: string | null;
    status?: MatterStatus;
  }): Promise<MatterRecord>;
  findById(id: string, userId: string): Promise<MatterRecord | null>;
  listByUser(userId: string): Promise<MatterRecord[]>;
  update(
    id: string,
    userId: string,
    params: {
      title?: string;
      clientName?: string | null;
      matterType?: MatterType;
      status?: MatterStatus;
      description?: string | null;
    },
  ): Promise<MatterRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  attachDocument(matterId: string, documentId: string): Promise<void>;
  detachDocument(matterId: string, documentId: string): Promise<void>;
  saveClauses(
    matterId: string,
    clauses: Array<{
      documentId: string;
      clauseType: string;
      content: string;
      riskLevel?: RiskLevel | null;
    }>,
  ): Promise<void>;
  saveDraft(
    matterId: string,
    draft: { id?: string; title: string; content: string; draftType: DraftType },
  ): Promise<MatterDraft>;
  deleteDraft(matterId: string, draftId: string): Promise<boolean>;
  getDetails(id: string, userId: string): Promise<MatterWithDetails | null>;
  getDocChunks(documentId: string): Promise<string[]>;
}

export function createMatterRepository(pgPool: pg.Pool): MatterRepository {
  async function create(params: {
    userId: string;
    title: string;
    clientName: string | null;
    matterType: MatterType;
    description: string | null;
    status?: MatterStatus;
  }): Promise<MatterRecord> {
    const status = params.status ?? 'open';
    const result = await pgPool.query<MatterRow>(
      `INSERT INTO matters (user_id, title, client_name, matter_type, status, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.userId,
        params.title,
        params.clientName,
        params.matterType,
        status,
        params.description,
      ],
    );
    return mapMatterRow(result.rows[0]);
  }

  async function findById(id: string, userId: string): Promise<MatterRecord | null> {
    const result = await pgPool.query<MatterRow>(
      `SELECT * FROM matters WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows[0] ? mapMatterRow(result.rows[0]) : null;
  }

  async function listByUser(userId: string): Promise<MatterRecord[]> {
    const result = await pgPool.query<MatterRow>(
      `SELECT m.*, COUNT(md.document_id)::int AS document_count
       FROM matters m
       LEFT JOIN matter_documents md ON md.matter_id = m.id
       WHERE m.user_id = $1
       GROUP BY m.id
       ORDER BY m.created_at DESC`,
      [userId],
    );
    return result.rows.map(mapMatterRow);
  }

  async function update(
    id: string,
    userId: string,
    params: {
      title?: string;
      clientName?: string | null;
      matterType?: MatterType;
      status?: MatterStatus;
      description?: string | null;
    },
  ): Promise<MatterRecord | null> {
    // Dynamically build the update query
    const setClause: string[] = [];
    const values: any[] = [id, userId];
    let index = 3;

    if (params.title !== undefined) {
      setClause.push(`title = $${index++}`);
      values.push(params.title);
    }
    if (params.clientName !== undefined) {
      setClause.push(`client_name = $${index++}`);
      values.push(params.clientName);
    }
    if (params.matterType !== undefined) {
      setClause.push(`matter_type = $${index++}`);
      values.push(params.matterType);
    }
    if (params.status !== undefined) {
      setClause.push(`status = $${index++}`);
      values.push(params.status);
    }
    if (params.description !== undefined) {
      setClause.push(`description = $${index++}`);
      values.push(params.description);
    }

    if (setClause.length === 0) {
      return findById(id, userId);
    }

    const query = `
      UPDATE matters
      SET ${setClause.join(', ')}, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pgPool.query<MatterRow>(query, values);
    return result.rows[0] ? mapMatterRow(result.rows[0]) : null;
  }

  async function deleteMatter(id: string, userId: string): Promise<boolean> {
    const result = await pgPool.query(`DELETE FROM matters WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async function attachDocument(matterId: string, documentId: string): Promise<void> {
    await pgPool.query(
      `INSERT INTO matter_documents (matter_id, document_id)
       VALUES ($1, $2)
       ON CONFLICT (matter_id, document_id) DO NOTHING`,
      [matterId, documentId],
    );
  }

  async function detachDocument(matterId: string, documentId: string): Promise<void> {
    await pgPool.query(
      `DELETE FROM matter_documents
       WHERE matter_id = $1 AND document_id = $2`,
      [matterId, documentId],
    );
  }

  async function saveClauses(
    matterId: string,
    clauses: Array<{
      documentId: string;
      clauseType: string;
      content: string;
      riskLevel?: RiskLevel | null;
    }>,
  ): Promise<void> {
    // Delete existing clauses first
    await pgPool.query(`DELETE FROM matter_clauses WHERE matter_id = $1`, [matterId]);

    if (clauses.length === 0) return;

    // Build multi-row insert query
    const valueStrings: string[] = [];
    const values: any[] = [matterId];
    let index = 2;

    for (const clause of clauses) {
      // Explicit index increment prevents undefined evaluation order of side-effects
      valueStrings.push(`($1, ${index}, ${index + 1}, ${index + 2}, ${index + 3})`);
      index += 4;
      values.push(clause.documentId);
      values.push(clause.clauseType);
      values.push(clause.content);
      values.push(clause.riskLevel ?? null);
    }

    const query = `
      INSERT INTO matter_clauses (matter_id, document_id, clause_type, content, risk_level)
      VALUES ${valueStrings.join(', ')}
    `;

    await pgPool.query(query, values);
  }

  async function saveDraft(
    matterId: string,
    draft: { id?: string; title: string; content: string; draftType: DraftType },
  ): Promise<MatterDraft> {
    if (draft.id) {
      const result = await pgPool.query<DraftRow>(
        `UPDATE matter_drafts
         SET title = $3, content = $4, draft_type = $5, updated_at = now()
         WHERE id = $1 AND matter_id = $2
         RETURNING *`,
        [draft.id, matterId, draft.title, draft.content, draft.draftType],
      );
      if (!result.rows[0]) {
        throw new Error('Draft not found for updating');
      }
      return mapDraftRow(result.rows[0]);
    } else {
      const result = await pgPool.query<DraftRow>(
        `INSERT INTO matter_drafts (matter_id, title, content, draft_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [matterId, draft.title, draft.content, draft.draftType],
      );
      return mapDraftRow(result.rows[0]);
    }
  }

  async function deleteDraft(matterId: string, draftId: string): Promise<boolean> {
    const result = await pgPool.query(
      `DELETE FROM matter_drafts WHERE id = $1 AND matter_id = $2`,
      [draftId, matterId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async function getDetails(id: string, userId: string): Promise<MatterWithDetails | null> {
    const matter = await findById(id, userId);
    if (!matter) return null;

    // Fetch attached documents
    const docResult = await pgPool.query<DocumentRow>(
      `SELECT d.* FROM documents d
       JOIN matter_documents md ON md.document_id = d.id
       WHERE md.matter_id = $1
       ORDER BY d.created_at DESC`,
      [id],
    );
    const attachedDocuments = docResult.rows.map(mapDocumentRow);

    // Fetch clauses
    const clauseResult = await pgPool.query<ClauseRow>(
      `SELECT * FROM matter_clauses WHERE matter_id = $1 ORDER BY created_at ASC`,
      [id],
    );
    const clauses = clauseResult.rows.map(mapClauseRow);

    // Fetch drafts
    const draftResult = await pgPool.query<DraftRow>(
      `SELECT * FROM matter_drafts WHERE matter_id = $1 ORDER BY created_at DESC`,
      [id],
    );
    const drafts = draftResult.rows.map(mapDraftRow);

    return {
      ...matter,
      attachedDocuments,
      clauses,
      drafts,
    };
  }

  async function getDocChunks(documentId: string): Promise<string[]> {
    const result = await pgPool.query<{ content: string }>(
      `SELECT content FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index ASC`,
      [documentId],
    );
    return result.rows.map((row) => row.content);
  }

  return {
    create,
    findById,
    listByUser,
    update,
    delete: deleteMatter,
    attachDocument,
    detachDocument,
    saveClauses,
    saveDraft,
    deleteDraft,
    getDetails,
    getDocChunks,
  };
}
