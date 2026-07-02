-- Phase 2: document ingestion schema (documents + document_chunks)

create extension if not exists vector;

create table documents (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  file_type    text not null check (file_type in ('pdf', 'docx', 'txt', 'image')),
  storage_path text not null,
  size_bytes   integer,
  status       text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  chunk_count  integer default 0,
  error_msg    text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index documents_user_id_idx on documents (user_id);
create index documents_firm_id_idx on documents (firm_id);

-- chunk_index/token_count are kept as real columns for ordering and token-budget
-- queries (see utils/tokens/tokenBudgetManager.ts); metadata stays JSONB so the
-- existing vectorStore/hybrid-retriever code (startChar/endChar/etc.) needs no changes.
create table document_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  chunk_index  integer not null,
  content      text not null,
  embedding    vector(1536),
  token_count  integer,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);

create index document_chunks_document_id_idx on document_chunks (document_id);

-- IVFFlat index for cosine similarity search
create index on document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Full-text search index, used by hybrid-retriever.ts keyword search
create index document_chunks_content_fts_idx on document_chunks
  using gin (to_tsvector('english', content));

-- RLS
alter table documents enable row level security;
alter table document_chunks enable row level security;

create policy "Users see own documents"
  on documents for all
  using (firm_id = public.get_auth_user_firm_id());

create policy "Users see own chunks"
  on document_chunks for all
  using (
    document_id in (
      select id from documents where firm_id = public.get_auth_user_firm_id()
    )
  );

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger documents_updated_at
  before update on documents
  for each row execute function update_updated_at();
