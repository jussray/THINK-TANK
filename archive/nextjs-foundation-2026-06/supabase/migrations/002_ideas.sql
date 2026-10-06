-- 002_ideas.sql
-- Ideas are the unit of everything. All other tables reference ideas.
-- idea_versions is created here (before the FK back-fill on ideas).

CREATE TABLE ideas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title               TEXT NOT NULL DEFAULT 'Untitled Idea',
  slug                TEXT UNIQUE,  -- URL-safe, auto-generated from title
  stage               TEXT NOT NULL DEFAULT 'idea'
                        CHECK (stage IN ('idea','blueprint','prototype','beta','revenue','growth')),
  privacy_status      TEXT NOT NULL DEFAULT 'private'
                        CHECK (privacy_status IN ('private','public','listed')),
  marketplace_status  TEXT
                        CHECK (marketplace_status IN ('active','paused','closed')),
  vault_flag          BOOLEAN DEFAULT false,
  current_version_id  UUID,  -- FK added below after idea_versions exists
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER ideas_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Slug generator: lowercase, hyphens, truncated at 60 chars + 8-char unique suffix
CREATE OR REPLACE FUNCTION generate_idea_slug(title TEXT, idea_id UUID)
RETURNS TEXT AS $$
DECLARE
  base TEXT;
  suffix TEXT;
BEGIN
  base := lower(regexp_replace(trim(title), '[^a-zA-Z0-9\s]', '', 'g'));
  base := regexp_replace(base, '\s+', '-', 'g');
  base := left(base, 52);
  suffix := left(replace(idea_id::text, '-', ''), 8);
  RETURN base || '-' || suffix;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_idea_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_idea_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ideas_set_slug
  BEFORE INSERT ON ideas
  FOR EACH ROW EXECUTE FUNCTION set_idea_slug();

-- Version snapshots: append-only, never deleted
CREATE TABLE idea_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id          UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  version_number   INTEGER NOT NULL,
  snapshot_json    JSONB NOT NULL,    -- full module state at this point in time
  change_summary   TEXT,
  hash_fingerprint TEXT NOT NULL,     -- SHA-256 of snapshot_json (tamper-evident)
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (idea_id, version_number)
);

CREATE INDEX idx_idea_versions_idea ON idea_versions(idea_id, version_number DESC);

-- Now back-fill the FK from ideas → idea_versions
ALTER TABLE ideas
  ADD CONSTRAINT fk_current_version
  FOREIGN KEY (current_version_id) REFERENCES idea_versions(id);

-- RLS for ideas
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Owner can do anything
CREATE POLICY ideas_owner ON ideas
  FOR ALL USING (owner_id::text = current_setting('app.current_user_id', true));

-- Public/listed ideas visible to anyone (authenticated or not), vault excluded
CREATE POLICY ideas_public_read ON ideas
  FOR SELECT USING (
    privacy_status IN ('public','listed')
    AND vault_flag = false
  );

-- RLS for idea_versions: follows parent idea's owner
ALTER TABLE idea_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY idea_versions_owner ON idea_versions
  FOR ALL USING (
    idea_id IN (
      SELECT id FROM ideas
      WHERE owner_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY idea_versions_public ON idea_versions
  FOR SELECT USING (
    idea_id IN (
      SELECT id FROM ideas
      WHERE privacy_status IN ('public','listed')
      AND vault_flag = false
    )
  );
