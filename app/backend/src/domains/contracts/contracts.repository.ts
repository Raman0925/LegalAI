import { SupabaseClient } from '@supabase/supabase-js';
import {
  Contract,
  ContractPage,
  ContractAnnotation,
} from './contracts.types.js';

// ─── Contracts ───────────────────────────────────────────────

export async function createContract(
  supabase: SupabaseClient,
  data: {
    firmId: string;
    userId: string;
    matterId?: string;
    filename: string;
    storagePath: string;
    storageUrl: string;
    fileSizeBytes: number;
  }
): Promise<Contract> {
  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({
      firm_id: data.firmId,
      user_id: data.userId,
      matter_id: data.matterId ?? null,
      filename: data.filename,
      storage_path: data.storagePath,
      storage_url: data.storageUrl,
      file_size_bytes: data.fileSizeBytes,
      status: 'uploaded',
    })
    .select()
    .single();

  if (error) {
    console.error('Database insertion error:', error);
    throw new Error('Failed to create contract record');
  }
  return mapContract(contract);
}

export async function updateContractStatus(
  supabase: SupabaseClient,
  contractId: string,
  firmId: string,
  status: Contract['status'],
  pageCount?: number
): Promise<void> {
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (pageCount !== undefined) update.page_count = pageCount;

  const { error } = await supabase
    .from('contracts')
    .update(update)
    .eq('id', contractId)
    .eq('firm_id', firmId); // always scope

  if (error) throw new Error('Failed to update contract status');
}

export async function getContractById(
  supabase: SupabaseClient,
  contractId: string,
  firmId: string
): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .eq('firm_id', firmId)
    .single();

  if (error) return null;
  return mapContract(data);
}

export async function getContractsByFirm(
  supabase: SupabaseClient,
  firmId: string
): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Failed to fetch contracts');
  return (data ?? []).map(mapContract);
}

// ─── Pages ───────────────────────────────────────────────────

export async function saveContractPages(
  supabase: SupabaseClient,
  pages: Omit<ContractPage, 'id'>[]
): Promise<void> {
  if (pages.length === 0) return;

  // Batch insert in chunks of 50 to avoid payload limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('contract_pages').insert(
      batch.map(p => ({
        contract_id: p.contractId,
        page_number: p.pageNumber,
        content: p.content,
        token_count: p.tokenCount,
      }))
    );
    if (error) throw new Error(`Failed to save pages batch ${i}`);
  }
}

export async function getContractPages(
  supabase: SupabaseClient,
  contractId: string,
  firmId: string
): Promise<ContractPage[]> {
  // Verify ownership first
  const contract = await getContractById(supabase, contractId, firmId);
  if (!contract) throw new Error('Contract not found');

  const { data, error } = await supabase
    .from('contract_pages')
    .select('*')
    .eq('contract_id', contractId)
    .order('page_number', { ascending: true });

  if (error) throw new Error('Failed to fetch contract pages');
  return (data ?? []).map(mapPage);
}

// ─── Annotations ─────────────────────────────────────────────

export async function saveAnnotation(
  supabase: SupabaseClient,
  annotation: Omit<ContractAnnotation, 'id' | 'createdAt'>
): Promise<ContractAnnotation> {
  const { data, error } = await supabase
    .from('contract_annotations')
    .insert({
      contract_id: annotation.contractId,
      page_number: annotation.pageNumber,
      clause_type: annotation.clauseType,
      risk_level: annotation.riskLevel,
      clause_text: annotation.clauseText,
      explanation: annotation.explanation,
      suggestion: annotation.suggestion,
      bbox: annotation.bbox,
      citation_ref: annotation.citationRef,
    })
    .select()
    .single();

  if (error) throw new Error('Failed to save annotation');
  return mapAnnotation(data);
}

export async function getAnnotationsByContract(
  supabase: SupabaseClient,
  contractId: string,
  firmId: string
): Promise<ContractAnnotation[]> {
  const contract = await getContractById(supabase, contractId, firmId);
  if (!contract) throw new Error('Contract not found');

  const { data, error } = await supabase
    .from('contract_annotations')
    .select('*')
    .eq('contract_id', contractId)
    .order('page_number', { ascending: true });

  if (error) throw new Error('Failed to fetch annotations');
  return (data ?? []).map(mapAnnotation);
}

// ─── Signed URL ───────────────────────────────────────────────

export async function getSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('contracts')
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) throw new Error('Failed to generate signed URL');
  return data.signedUrl;
}

// ─── Mappers ─────────────────────────────────────────────────

function mapContract(row: Record<string, unknown>): Contract {
  return {
    id: row.id as string,
    firmId: row.firm_id as string,
    userId: row.user_id as string,
    matterId: row.matter_id as string | null,
    filename: row.filename as string,
    storagePath: row.storage_path as string,
    storageUrl: row.storage_url as string,
    fileSizeBytes: Number(row.file_size_bytes),
    pageCount: row.page_count as number | null,
    status: row.status as Contract['status'],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapPage(row: Record<string, unknown>): ContractPage {
  return {
    id: row.id as string,
    contractId: row.contract_id as string,
    pageNumber: row.page_number as number,
    content: row.content as string,
    tokenCount: row.token_count as number | null,
  };
}

function mapAnnotation(row: Record<string, unknown>): ContractAnnotation {
  return {
    id: row.id as string,
    contractId: row.contract_id as string,
    pageNumber: row.page_number as number,
    clauseType: row.clause_type as string,
    riskLevel: row.risk_level as ContractAnnotation['riskLevel'],
    clauseText: row.clause_text as string,
    explanation: row.explanation as string,
    suggestion: row.suggestion as string | null,
    bbox: row.bbox as ContractAnnotation['bbox'],
    citationRef: row.citation_ref as string | null,
    createdAt: new Date(row.created_at as string),
  };
}
