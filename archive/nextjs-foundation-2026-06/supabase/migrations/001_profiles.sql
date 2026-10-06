-- 001_profiles.sql
-- Profiles: app-level user data. Auth is handled by Clerk.
-- Clerk user IDs are UUIDs — we use them as the primary key directly.

CREATE TABLE profiles (
  id               UUID PRIMARY KEY,  -- Clerk user_id, synced via webhook
  display_name     TEXT,
  bio              TEXT,
  domain_tags      TEXT[]          DEFAULT '{}',
  avatar_url       TEXT,
  founder_mode     TEXT            DEFAULT 'dreamer'
                     CHECK (founder_mode IN ('dreamer','builder','investor','team_builder')),
  is_public        BOOLEAN         DEFAULT false,
  reputation_score NUMERIC(4,2)    DEFAULT 0,
  created_at       TIMESTAMPTZ     DEFAULT now(),
  updated_at       TIMESTAMPTZ     DEFAULT now()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: users can read public profiles; can only write their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_read_public ON profiles
  FOR SELECT USING (is_public = true);

CREATE POLICY profiles_read_own ON profiles
  FOR SELECT USING (id::text = current_setting('app.current_user_id', true));

CREATE POLICY profiles_write_own ON profiles
  FOR ALL USING (id::text = current_setting('app.current_user_id', true));
