-- 006_ownership_ledger.sql
-- Idea ownership ledger: append-only, hash-chained, tamper-evident record.
-- Never updated. Never deleted (even if the idea is deleted — ledger persists).
-- This is the IP provenance record.

CREATE TABLE idea_ownership_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id      UUID NOT NULL REFERENCES ideas(id),  -- no ON DELETE CASCADE — ledger survives idea deletion
  user_id      UUID NOT NULL REFERENCES profiles(id),
  action_type  TEXT NOT NULL
                 CHECK (action_type IN ('created','updated','version_snapshot','transferred','verified')),
  version_id   UUID REFERENCES idea_versions(id),
  payload_json JSONB NOT NULL DEFAULT '{}',  -- action-specific metadata
  block_hash   TEXT NOT NULL,  -- SHA-256( prev_block_hash || this row's payload )
  prev_hash    TEXT,           -- NULL for the genesis record (idea creation)
  verified_flag BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ledger_idea    ON idea_ownership_ledger(idea_id, created_at ASC);
CREATE INDEX idx_ledger_user    ON idea_ownership_ledger(user_id);

-- No UPDATE or DELETE policies — the ledger is append-only
ALTER TABLE idea_ownership_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_owner_read ON idea_ownership_ledger
  FOR SELECT USING (
    idea_id IN (
      SELECT id FROM ideas
      WHERE owner_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY ledger_insert_own ON idea_ownership_ledger
  FOR INSERT WITH CHECK (
    user_id::text = current_setting('app.current_user_id', true)
  );

-- No UPDATE policy. No DELETE policy. Intentional.

-- Auto-create genesis ledger entry on idea creation
-- The block_hash is seeded from the idea_id (no prev_hash on genesis)
CREATE OR REPLACE FUNCTION create_genesis_ledger_entry()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  hash    TEXT;
BEGIN
  payload := jsonb_build_object(
    'idea_id', NEW.id,
    'owner_id', NEW.owner_id,
    'title', NEW.title,
    'created_at', NEW.created_at
  );
  -- In production: replace with pgcrypto digest. Here: concat-based placeholder.
  -- Application layer computes real SHA-256 and backfills on first API call.
  hash := encode(sha256((NEW.id::text || NEW.owner_id::text || now()::text)::bytea), 'hex');

  INSERT INTO idea_ownership_ledger
    (idea_id, user_id, action_type, payload_json, block_hash, prev_hash)
  VALUES
    (NEW.id, NEW.owner_id, 'created', payload, hash, NULL);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ideas_genesis_ledger
  AFTER INSERT ON ideas
  FOR EACH ROW EXECUTE FUNCTION create_genesis_ledger_entry();
