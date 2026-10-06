-- 004_modules.sql
-- Modules: the plug-in surface. One row per module type per idea.
-- module_type is a TEXT field — not a DB enum — so new types never require a migration.
-- All type enforcement happens at the application layer (TypeScript + Zod).

CREATE TABLE modules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id           UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  version_id        UUID REFERENCES idea_versions(id),
  module_type       TEXT NOT NULL,
  -- Known types (application-enforced, not DB-enforced):
  -- 'summary' | 'problem' | 'solution' | 'customer' | 'scorecard'
  -- 'revenue' | 'roadmap' | 'pitch' | 'action_plan'
  -- 'growth_strategy' | 'competitive_landscape' | 'discovery_synthesis'
  -- New types plug in here by adding to the TypeScript registry only.
  content_json      JSONB NOT NULL DEFAULT '{}',
  generation_status TEXT NOT NULL DEFAULT 'pending'
                      CHECK (generation_status IN ('pending','generating','complete','error','draft')),
  generated_at      TIMESTAMPTZ,
  last_edited_at    TIMESTAMPTZ,
  edit_source       TEXT CHECK (edit_source IN ('user','ai','system')),
  confidence_map    JSONB,   -- per-claim: {"market_size": "inferred", "problem": "stated"}
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (idea_id, module_type)   -- one active module per type per idea
);

CREATE TRIGGER modules_updated_at
  BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_modules_idea      ON modules(idea_id);
CREATE INDEX idx_modules_idea_type ON modules(idea_id, module_type);
CREATE INDEX idx_modules_status    ON modules(idea_id, generation_status);

-- RLS: follows parent idea
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY modules_owner ON modules
  FOR ALL USING (
    idea_id IN (
      SELECT id FROM ideas
      WHERE owner_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY modules_public ON modules
  FOR SELECT USING (
    idea_id IN (
      SELECT id FROM ideas
      WHERE privacy_status IN ('public','listed')
      AND vault_flag = false
    )
  );

-- Scaffold function: creates pending module rows for all known types
-- Called on idea creation so the workspace can render empty states immediately
CREATE OR REPLACE FUNCTION scaffold_idea_modules(p_idea_id UUID)
RETURNS void AS $$
DECLARE
  module_types TEXT[] := ARRAY[
    'summary','problem','solution','customer','scorecard',
    'revenue','roadmap','pitch','action_plan',
    'growth_strategy','competitive_landscape','discovery_synthesis'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY module_types LOOP
    INSERT INTO modules (idea_id, module_type, generation_status)
    VALUES (p_idea_id, t, 'pending')
    ON CONFLICT (idea_id, module_type) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Auto-scaffold modules on idea creation
CREATE OR REPLACE FUNCTION auto_scaffold_modules()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM scaffold_idea_modules(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ideas_scaffold_modules
  AFTER INSERT ON ideas
  FOR EACH ROW EXECUTE FUNCTION auto_scaffold_modules();
