-- 005_ai_memory.sql
-- AI memory threads: long-term context store for Interview Agent and Coach Agent.
-- Three thread types, each with an embedding for RAG retrieval.
-- pgvector must be enabled on the Supabase project before this runs.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ai_memory_threads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id            UUID REFERENCES ideas(id) ON DELETE CASCADE,  -- NULL for founder_profile type
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  thread_type        TEXT NOT NULL
                       CHECK (thread_type IN ('idea_context','founder_profile','session_summary')),
  raw_content        TEXT NOT NULL,       -- plain text fed to the embedding model
  content_embedding  VECTOR(1536),        -- OpenAI text-embedding-3-small
  last_updated       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (idea_id, user_id, thread_type)  -- one thread per type per idea per user
);

-- IVFFlat index for approximate nearest-neighbor search
-- lists=100 is appropriate for up to ~1M rows; increase if needed
CREATE INDEX idx_memory_embedding ON ai_memory_threads
  USING ivfflat (content_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_memory_user       ON ai_memory_threads(user_id, thread_type);
CREATE INDEX idx_memory_idea       ON ai_memory_threads(idea_id) WHERE idea_id IS NOT NULL;

-- Similarity search function: returns top-k threads by cosine similarity
-- Used by Interview Agent context builder
CREATE OR REPLACE FUNCTION search_memory(
  query_embedding VECTOR(1536),
  match_user_id   UUID,
  match_idea_id   UUID DEFAULT NULL,
  match_type      TEXT DEFAULT NULL,
  match_count     INTEGER DEFAULT 5
)
RETURNS TABLE (
  id           UUID,
  thread_type  TEXT,
  raw_content  TEXT,
  similarity   FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    amt.id,
    amt.thread_type,
    amt.raw_content,
    1 - (amt.content_embedding <=> query_embedding) AS similarity
  FROM ai_memory_threads amt
  WHERE
    amt.user_id = match_user_id
    AND (match_idea_id IS NULL OR amt.idea_id = match_idea_id)
    AND (match_type IS NULL OR amt.thread_type = match_type)
    AND amt.content_embedding IS NOT NULL
  ORDER BY amt.content_embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- RLS: memory is always private to the owning user
ALTER TABLE ai_memory_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY memory_owner ON ai_memory_threads
  FOR ALL USING (user_id::text = current_setting('app.current_user_id', true));
