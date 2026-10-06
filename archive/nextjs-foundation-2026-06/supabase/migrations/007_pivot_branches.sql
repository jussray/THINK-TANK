-- 007_pivot_branches.sql
-- Pivot branches: one row per explored pivot direction.
-- Original idea is always preserved — a pivot creates a branch, never a deletion.
-- If the founder commits to a pivot, modules are overwritten but the pre-pivot
-- version snapshot in idea_versions is permanent.

CREATE TABLE pivot_branches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id           UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id),

  -- The version snapshot taken BEFORE the pivot was explored
  -- This is the restoration point if the founder abandons the pivot
  pre_pivot_version_id UUID NOT NULL REFERENCES idea_versions(id),

  -- Which component of the original idea this direction retains
  retained_component TEXT NOT NULL
    CHECK (retained_component IN ('technology','customer_segment','problem_framing','business_model','team_insight')),

  -- AI-generated direction card content
  direction_label   TEXT NOT NULL,        -- e.g. "Same technology, new customer"
  direction_summary TEXT NOT NULL,        -- 2–3 sentences describing the pivot
  direction_rationale TEXT NOT NULL,      -- why this retained component is worth keeping
  hypothesis        TEXT NOT NULL,        -- the core testable hypothesis of this direction

  -- Exploration state
  status            TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','exploring','committed','abandoned')),

  -- If exploring: the interview session for this branch
  exploration_interview_id UUID REFERENCES interviews(id),

  -- If committed: the new modules generated for this direction
  -- (modules table is updated in-place; this records what was generated)
  committed_at      TIMESTAMPTZ,
  committed_version_id UUID REFERENCES idea_versions(id),

  -- Scorecard generated for this direction (if exploration completed)
  branch_scorecard  JSONB,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER pivot_branches_updated_at
  BEFORE UPDATE ON pivot_branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pivot_branches_idea ON pivot_branches(idea_id, created_at DESC);
CREATE INDEX idx_pivot_branches_status ON pivot_branches(idea_id, status);

-- RLS: owner only
ALTER TABLE pivot_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY pivot_branches_owner ON pivot_branches
  FOR ALL USING (
    idea_id IN (
      SELECT id FROM ideas
      WHERE owner_id::text = current_setting('app.current_user_id', true)
    )
  );
