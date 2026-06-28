-- migration: 007_legal_documents.sql

CREATE TABLE IF NOT EXISTS legal_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL, -- firm scoping
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id     UUID REFERENCES matters(id) ON DELETE SET NULL,
  title         TEXT NOT NULL DEFAULT 'Untitled Document',
  content       JSONB NOT NULL DEFAULT '{}',   -- TipTap JSON output
  word_count    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'review', 'final', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  firm_id       UUID NOT NULL, -- firm scoping
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       JSONB NOT NULL,               -- immutable snapshot
  word_count    INTEGER NOT NULL DEFAULT 0,
  label         TEXT,                         -- optional: "Before client review"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_legal_docs_firm     ON legal_documents(firm_id);
CREATE INDEX IF NOT EXISTS idx_legal_docs_matter   ON legal_documents(matter_id);
CREATE INDEX IF NOT EXISTS idx_legal_docs_status   ON legal_documents(status);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc    ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_firm   ON document_versions(firm_id);

-- RLS
ALTER TABLE legal_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_docs" ON legal_documents
  USING (firm_id = coalesce(current_setting('app.current_firm_id', true), '00000000-0000-0000-0000-000000000000')::UUID);

CREATE POLICY "firm_isolation_versions" ON document_versions
  USING (firm_id = coalesce(current_setting('app.current_firm_id', true), '00000000-0000-0000-0000-000000000000')::UUID);
