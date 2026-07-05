import { SupabaseClient } from '@supabase/supabase-js';
import { LegalDocument, DocumentVersion, JSONContent } from './editor.types.js';

// ─── Documents ────────────────────────────────────────────────

export async function createDocument(
  supabase: SupabaseClient,
  data: {
    firmId: string;
    userId: string;
    matterId?: string;
    title: string;
    content: JSONContent;
  }
): Promise<LegalDocument> {
  const { data: doc, error } = await supabase
    .from('legal_documents')
    .insert({
      firm_id: data.firmId,
      user_id: data.userId,
      matter_id: data.matterId ?? null,
      title: data.title,
      content: data.content,
      word_count: 0,
    })
    .select()
    .single();

  if (error) throw new Error('Failed to create document');
  return mapDocument(doc);
}

export async function getDocumentById(
  supabase: SupabaseClient,
  documentId: string,
  firmId: string
): Promise<LegalDocument | null> {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('*')
    .eq('id', documentId)
    .eq('firm_id', firmId)       // always scope to firm
    .single();

  if (error) return null;
  return mapDocument(data);
}

export async function getDocumentsByFirm(
  supabase: SupabaseClient,
  firmId: string,
  matterId?: string
): Promise<LegalDocument[]> {
  let query = supabase
    .from('legal_documents')
    .select('id, firm_id, user_id, matter_id, title, word_count, status, created_at, updated_at')
    .eq('firm_id', firmId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (matterId) query = query.eq('matter_id', matterId);

  const { data, error } = await query;
  if (error) throw new Error('Failed to fetch documents');

  // Return without content — too heavy for list view
  return (data ?? []).map(row => ({
    ...mapDocument(row),
    content: {},
  }));
}

export async function updateDocument(
  supabase: SupabaseClient,
  documentId: string,
  firmId: string,
  data: {
    title?: string;
    content?: JSONContent;
    wordCount?: number;
    status?: LegalDocument['status'];
  },
  expectedVersion?: number
): Promise<LegalDocument> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) update.title = data.title;
  if (data.content !== undefined) update.content = data.content;
  if (data.wordCount !== undefined) update.word_count = data.wordCount;
  if (data.status !== undefined) update.status = data.status;

  let query = supabase
    .from('legal_documents')
    .update(update)
    .eq('id', documentId)
    .eq('firm_id', firmId);

  if (expectedVersion !== undefined) {
    query = query.eq('version', expectedVersion);
  }

  const { data: doc, error } = await query.select().single();

  if (error) {
    if (error.code === 'PGRST116') {
      const existing = await getDocumentById(supabase, documentId, firmId);
      if (existing) {
        throw new Error('CONCURRENCY_CONFLICT');
      }
    }
    throw new Error('Failed to update document: ' + error.message);
  }
  return mapDocument(doc);
}

// ─── Versions ─────────────────────────────────────────────────

export async function saveVersion(
  supabase: SupabaseClient,
  data: {
    documentId: string;
    firmId: string;
    userId: string;
    content: JSONContent;
    wordCount: number;
    label?: string;
  }
): Promise<DocumentVersion> {
  const { data: version, error } = await supabase
    .from('document_versions')
    .insert({
      document_id: data.documentId,
      firm_id: data.firmId,
      user_id: data.userId,
      content: data.content,
      word_count: data.wordCount,
      label: data.label ?? null,
    })
    .select()
    .single();

  if (error) throw new Error('Failed to save version');
  return mapVersion(version);
}

export async function getVersionsByDocument(
  supabase: SupabaseClient,
  documentId: string,
  firmId: string
): Promise<Omit<DocumentVersion, 'content'>[]> {
  // Verify ownership
  const doc = await getDocumentById(supabase, documentId, firmId);
  if (!doc) throw new Error('Document not found');

  const { data, error } = await supabase
    .from('document_versions')
    .select('id, document_id, firm_id, user_id, word_count, label, created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(50);                   // cap version history at 50

  if (error) throw new Error('Failed to fetch versions');
  return (data ?? []).map(row => ({ ...mapVersion(row), content: {} as JSONContent }));
}

export async function getVersionById(
  supabase: SupabaseClient,
  versionId: string,
  firmId: string
): Promise<DocumentVersion | null> {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('id', versionId)
    .eq('firm_id', firmId)
    .single();

  if (error) return null;
  return mapVersion(data);
}

// ─── Mappers ──────────────────────────────────────────────────

function mapDocument(row: Record<string, unknown>): LegalDocument {
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    userId: row.user_id as string,
    matterId: row.matter_id as string | null,
    title: row.title as string,
    content: (row.content ?? {}) as JSONContent,
    wordCount: row.word_count as number,
    saveCount: (row.save_count ?? 0) as number,
    version: (row.version ?? 1) as number,
    status: row.status as LegalDocument['status'],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapVersion(row: Record<string, unknown>): DocumentVersion {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    firmId: row.firm_id as string,
    userId: row.user_id as string,
    content: (row.content ?? {}) as JSONContent,
    wordCount: row.word_count as number,
    label: row.label as string | null,
    createdAt: new Date(row.created_at as string),
  };
}
