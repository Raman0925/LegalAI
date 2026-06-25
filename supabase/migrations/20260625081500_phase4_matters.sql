-- Phase 4: Matters database schema

CREATE TABLE matters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  client_name  TEXT,
  matter_type  TEXT NOT NULL DEFAULT 'general'
                 CHECK (matter_type IN ('general','contract','litigation','advisory','compliance')),
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','in_progress','closed','archived')),
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX matters_user_id_idx ON matters (user_id);

CREATE TABLE matter_documents (
  matter_id   UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (matter_id, document_id)
);

CREATE TABLE matter_clauses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  clause_type TEXT NOT NULL,
  content     TEXT NOT NULL,
  risk_level  TEXT CHECK (risk_level IN ('high','medium','low')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX matter_clauses_matter_id_idx ON matter_clauses (matter_id);

CREATE TABLE matter_drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  draft_type  TEXT NOT NULL
                CHECK (draft_type IN ('contract','letter','memo','clause')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX matter_drafts_matter_id_idx ON matter_drafts (matter_id);

-- RLS
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own matters"
  ON matters FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own matter_documents"
  ON matter_documents FOR ALL
  USING (matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own matter_clauses"
  ON matter_clauses FOR ALL
  USING (matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own matter_drafts"
  ON matter_drafts FOR ALL
  USING (matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid()));

-- Trigger updated_at on matters and matter_drafts
CREATE TRIGGER matters_updated_at
  BEFORE UPDATE ON matters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER matter_drafts_updated_at
  BEFORE UPDATE ON matter_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
