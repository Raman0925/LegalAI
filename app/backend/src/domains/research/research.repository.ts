import { SupabaseClient } from '@supabase/supabase-js';
import { ResearchSession, ResearchMessage, ResearchCitation } from './research.types.js';

export async function createSession(
  supabase: SupabaseClient,
  data: {
    firmId: string;
    userId: string;
    matterId?: string;
    title: string;
    query: string;
  }
): Promise<ResearchSession> {
  const { data: session, error } = await supabase
    .from('research_sessions')
    .insert({
      firm_id: data.firmId,
      user_id: data.userId,
      matter_id: data.matterId ?? null,
      title: data.title,
      query: data.query,
    })
    .select()
    .single();

  if (error) throw new Error('Failed to create research session');
  return mapSession(session);
}

export async function getSessionsByFirm(
  supabase: SupabaseClient,
  firmId: string
): Promise<ResearchSession[]> {
  const { data, error } = await supabase
    .from('research_sessions')
    .select('*')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Failed to fetch sessions');
  return (data ?? []).map(mapSession);
}

export async function getSessionById(
  supabase: SupabaseClient,
  sessionId: string,
  firmId: string
): Promise<ResearchSession | null> {
  const { data, error } = await supabase
    .from('research_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('firm_id', firmId)   // ← always scope to firm
    .single();

  if (error) return null;
  return mapSession(data);
}

export async function saveMessage(
  supabase: SupabaseClient,
  data: { sessionId: string; role: 'user' | 'assistant'; content: string }
): Promise<ResearchMessage> {
  const { data: msg, error } = await supabase
    .from('research_messages')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error('Failed to save message');
  return { ...mapMessage(msg), citations: [] };
}

export async function saveCitations(
  supabase: SupabaseClient,
  citations: Omit<ResearchCitation, 'id' | 'createdAt'>[]
): Promise<ResearchCitation[]> {
  if (citations.length === 0) return [];

  const { data, error } = await supabase
    .from('research_citations')
    .insert(citations.map(c => ({
      message_id: c.messageId,
      session_id: c.sessionId,
      source_document_id: c.sourceDocumentId,
      document_name: c.documentName,
      page_number: c.pageNumber,
      chunk_preview: c.chunkPreview,
      relevance_score: c.relevanceScore,
      citation_index: c.citationIndex,
    })))
    .select();

  if (error) throw new Error('Failed to save citations');
  return (data ?? []).map(mapCitation);
}

export async function getMessagesBySession(
  supabase: SupabaseClient,
  sessionId: string,
  firmId: string
): Promise<ResearchMessage[]> {
  // Verify session belongs to firm first
  const session = await getSessionById(supabase, sessionId, firmId);
  if (!session) throw new Error('Session not found');

  const { data: messages, error } = await supabase
    .from('research_messages')
    .select(`*, research_citations(*)`)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error('Failed to fetch messages');

  return (messages ?? []).map(m => ({
    ...mapMessage(m),
    citations: (m.research_citations ?? []).map(mapCitation),
  }));
}

// Private mappers — keep DB column names out of business logic
function mapSession(row: Record<string, unknown>): ResearchSession {
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    userId: row.user_id as string,
    matterId: row.matter_id as string | null,
    title: row.title as string,
    query: row.query as string,
    status: row.status as ResearchSession['status'],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapMessage(row: Record<string, unknown>): Omit<ResearchMessage, 'citations'> {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
    createdAt: new Date(row.created_at as string),
  };
}

function mapCitation(row: Record<string, unknown>): ResearchCitation {
  return {
    id: row.id as string,
    messageId: row.message_id as string,
    sessionId: row.session_id as string,
    sourceDocumentId: row.source_document_id as string | null,
    documentName: row.document_name as string,
    pageNumber: row.page_number as number | null,
    chunkPreview: row.chunk_preview as string,
    relevanceScore: row.relevance_score as number,
    citationIndex: row.citation_index as number,
  };
}
