-- migration: 20260706010000_phase10_research.sql
-- Adds the research domain's schema: research_sessions, research_messages,
-- research_citations, and the hybrid_search_documents() RPC used by
-- research.service.ts. None of this previously existed in any migration —
-- the app code was reading/writing tables the database never defined.

-- ─── 1. research_sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id   UUID REFERENCES matters(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  query       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. research_messages ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. research_citations ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_citations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          UUID NOT NULL REFERENCES research_messages(id) ON DELETE CASCADE,
  session_id          UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  source_document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  document_name       TEXT NOT NULL,
  page_number         INTEGER,
  chunk_preview       TEXT NOT NULL,
  relevance_score     REAL NOT NULL DEFAULT 0,
  citation_index      INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_research_sessions_firm    ON research_sessions(firm_id);
CREATE INDEX IF NOT EXISTS idx_research_sessions_matter  ON research_sessions(matter_id);
CREATE INDEX IF NOT EXISTS idx_research_messages_session ON research_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_research_citations_message ON research_citations(message_id);
CREATE INDEX IF NOT EXISTS idx_research_citations_session ON research_citations(session_id);

-- ─── 5. updated_at trigger (reuses the shared trigger fn from phase2) ────────

CREATE TRIGGER research_sessions_updated_at
  BEFORE UPDATE ON research_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE research_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_citations  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_research_sessions" ON research_sessions
  USING (firm_id = public.get_auth_user_firm_id());

CREATE POLICY "firm_isolation_research_messages" ON research_messages
  USING (session_id IN (
    SELECT id FROM research_sessions
    WHERE firm_id = public.get_auth_user_firm_id()
  ));

CREATE POLICY "firm_isolation_research_citations" ON research_citations
  USING (session_id IN (
    SELECT id FROM research_sessions
    WHERE firm_id = public.get_auth_user_firm_id()
  ));

-- ─── 7. hybrid_search_documents() — vector + keyword search, scoped to firm ──
-- Called via supabase.rpc('hybrid_search_documents', { query_text, query_embedding,
-- firm_id, matter_id, match_count }) from research.service.ts. Runs as the raw
-- `postgres` connection (service role), which bypasses RLS entirely — so this
-- function is the ONLY thing standing between one firm's documents and another's.
-- SECURITY DEFINER + explicit firm_id scoping in the WHERE clause enforces that
-- boundary independently of RLS.
CREATE OR REPLACE FUNCTION public.hybrid_search_documents(
  query_text TEXT,
  query_embedding VECTOR(1536),
  firm_id UUID,
  matter_id UUID DEFAULT NULL,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  document_id UUID,
  document_name TEXT,
  page_number INT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  WITH params AS (
    SELECT
      firm_id AS p_firm_id,
      matter_id AS p_matter_id,
      match_count AS p_match_count,
      query_text AS p_query_text,
      query_embedding AS p_query_embedding
  ),
  scoped_documents AS (
    SELECT d.id, d.name
    FROM documents d, params
    WHERE d.firm_id = params.p_firm_id
      AND (
        params.p_matter_id IS NULL
        OR d.id IN (
          SELECT md.document_id FROM matter_documents md
          WHERE md.matter_id = params.p_matter_id
        )
      )
  ),
  vector_matches AS (
    SELECT dc.id, dc.document_id, dc.content,
           ROW_NUMBER() OVER (ORDER BY dc.embedding <=> params.p_query_embedding) AS rnk
    FROM document_chunks dc, params
    WHERE dc.document_id IN (SELECT id FROM scoped_documents)
    ORDER BY dc.embedding <=> params.p_query_embedding
    LIMIT (SELECT p_match_count * 2 FROM params)
  ),
  keyword_matches AS (
    SELECT dc.id, dc.document_id, dc.content,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', params.p_query_text)) DESC
           ) AS rnk
    FROM document_chunks dc, params
    WHERE dc.document_id IN (SELECT id FROM scoped_documents)
      AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', params.p_query_text)
    LIMIT (SELECT p_match_count * 2 FROM params)
  ),
  fused AS (
    SELECT id, document_id, content, SUM(1.0 / (60 + rnk)) AS fused_score
    FROM (
      SELECT id, document_id, content, rnk FROM vector_matches
      UNION ALL
      SELECT id, document_id, content, rnk FROM keyword_matches
    ) combined
    GROUP BY id, document_id, content
  )
  SELECT
    f.document_id,
    sd.name AS document_name,
    NULL::INT AS page_number,
    f.content,
    f.fused_score AS similarity
  FROM fused f
  JOIN scoped_documents sd ON sd.id = f.document_id
  ORDER BY f.fused_score DESC
  LIMIT (SELECT p_match_count FROM params);
$$;
