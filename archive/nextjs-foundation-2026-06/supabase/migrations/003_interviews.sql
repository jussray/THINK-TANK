-- 003_interviews.sql
-- Interviews: one session per row.
-- interview_messages: every single turn, stored forever.

CREATE TABLE interviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id          UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id),
  session_number   INTEGER NOT NULL,
  interview_mode   TEXT NOT NULL DEFAULT 'initial'
                     CHECK (interview_mode IN ('initial','module_refine','pivot','checkin','discovery')),
  target_module    TEXT,             -- populated when mode = 'module_refine'
  depth_score      NUMERIC(3,2),     -- 0.00–1.00, written at session end
  concept_map      JSONB DEFAULT '{  -- running extraction, updated after each turn
    "problem_clarity":       {"value": "", "confidence": 0},
    "solution_specificity":  {"value": "", "confidence": 0},
    "customer_definition":   {"value": "", "confidence": 0},
    "revenue_hypothesis":    {"value": "", "confidence": 0},
    "market_awareness":      {"value": "", "confidence": 0},
    "competitive_awareness": {"value": "", "confidence": 0},
    "founder_motivation":    {"value": "", "confidence": 0},
    "execution_readiness":   {"value": "", "confidence": 0},
    "overall_completeness":  0
  }'::jsonb,
  started_at       TIMESTAMPTZ DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  UNIQUE (idea_id, session_number)
);

CREATE INDEX idx_interviews_idea ON interviews(idea_id, session_number DESC);
CREATE INDEX idx_interviews_user ON interviews(user_id);

CREATE TABLE interview_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id       UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  role               TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content            TEXT NOT NULL,
  agent_persona      TEXT,   -- 'interview' | 'synthesis' | 'critic' | 'scorer' | 'coach' | 'researcher'
  flagged_as_insight BOOLEAN DEFAULT false,
  token_count        INTEGER,   -- for Helicone cost attribution
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_interview ON interview_messages(interview_id, created_at ASC);

-- RLS: interviews are always private to the idea owner
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY interviews_owner ON interviews
  FOR ALL USING (
    idea_id IN (
      SELECT id FROM ideas
      WHERE owner_id::text = current_setting('app.current_user_id', true)
    )
  );

ALTER TABLE interview_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_owner ON interview_messages
  FOR ALL USING (
    interview_id IN (
      SELECT i.id FROM interviews i
      JOIN ideas ON ideas.id = i.idea_id
      WHERE ideas.owner_id::text = current_setting('app.current_user_id', true)
    )
  );
