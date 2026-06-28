-- migration: 006_contracts.sql

CREATE TABLE IF NOT EXISTS contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL, -- references firms(id) if firms table existed, but user-level RLS scopes this
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id       UUID REFERENCES matters(id) ON DELETE SET NULL,
  filename        TEXT NOT NULL,
  storage_path    TEXT NOT NULL,           -- contracts/{firm_id}/{id}/{filename}
  storage_url     TEXT NOT NULL,           -- signed URL base (regenerated on access)
  file_size_bytes BIGINT NOT NULL,
  page_count      INTEGER,
  status          TEXT NOT NULL DEFAULT 'uploaded'
                    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_pages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  page_number  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  token_count  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  page_number   INTEGER NOT NULL,
  clause_type   TEXT NOT NULL,
  risk_level    TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  clause_text   TEXT NOT NULL,             -- exact text from contract
  explanation   TEXT NOT NULL,             -- plain English explanation
  suggestion    TEXT,                      -- optional improvement suggestion
  bbox          JSONB,                     -- { x1, y1, x2, y2 } for highlight (future)
  citation_ref  TEXT,                      -- e.g. "Clause 7.2(b)"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_firm ON contracts(firm_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contract_pages_contract ON contract_pages(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_pages_page ON contract_pages(contract_id, page_number);
CREATE INDEX IF NOT EXISTS idx_annotations_contract ON contract_annotations(contract_id);
CREATE INDEX IF NOT EXISTS idx_annotations_page ON contract_annotations(contract_id, page_number);
CREATE INDEX IF NOT EXISTS idx_annotations_risk ON contract_annotations(contract_id, risk_level);

-- RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_contracts" ON contracts
  USING (firm_id = coalesce(current_setting('app.current_firm_id', true), '00000000-0000-0000-0000-000000000000')::UUID);

CREATE POLICY "firm_isolation_pages" ON contract_pages
  USING (contract_id IN (
    SELECT id FROM contracts
    WHERE firm_id = coalesce(current_setting('app.current_firm_id', true), '00000000-0000-0000-0000-000000000000')::UUID
  ));

CREATE POLICY "firm_isolation_annotations" ON contract_annotations
  USING (contract_id IN (
    SELECT id FROM contracts
    WHERE firm_id = coalesce(current_setting('app.current_firm_id', true), '00000000-0000-0000-0000-000000000000')::UUID
  ));
