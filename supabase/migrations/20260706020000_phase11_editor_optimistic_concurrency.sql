-- migration: 20260706020000_phase11_editor_optimistic_concurrency.sql
-- Adds optimistic concurrency versioning to legal_documents, and
-- triggers automatic increment of save_count on updates.

ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION increment_legal_documents_save_count_and_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content OR NEW.title IS DISTINCT FROM OLD.title THEN
    NEW.save_count = OLD.save_count + 1;
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER legal_documents_save_count_trigger
  BEFORE UPDATE ON legal_documents
  FOR EACH ROW EXECUTE FUNCTION increment_legal_documents_save_count_and_version();
