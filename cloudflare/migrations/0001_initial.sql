-- Think Tank Cloudflare D1 canonical schema v1.
-- Owner identity comes ONLY from a verified Cloudflare Access JWT in Worker.
-- SQLite has no RLS: every external read/write MUST be constrained by owner_id.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ideas (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 4000),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 100),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ideas_by_owner ON ideas(owner_id,created_at DESC);

CREATE TABLE IF NOT EXISTS interview_messages (
 id TEXT PRIMARY KEY NOT NULL,
 idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
 seq INTEGER NOT NULL CHECK(seq>0),
 role TEXT NOT NULL CHECK(role IN ('founder','interviewer')),
 content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 8000),
 run_id TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(idea_id,seq)
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_question_per_run
 ON interview_messages(run_id) WHERE run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_executions (
 id TEXT PRIMARY KEY NOT NULL,
 idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL,
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 12 AND 128),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 run_id TEXT UNIQUE NOT NULL,
 answer_content TEXT NOT NULL CHECK(length(trim(answer_content)) BETWEEN 1 AND 8000),
 input_revision INTEGER NOT NULL CHECK(input_revision BETWEEN 1 AND 100),
 input_snapshot TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(input_snapshot)),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(idea_id,owner_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS executions_by_owner ON agent_executions(owner_id,created_at DESC);

CREATE TABLE IF NOT EXISTS ai_runs (
 id TEXT PRIMARY KEY NOT NULL,
 execution_id TEXT NOT NULL UNIQUE REFERENCES agent_executions(id) ON DELETE CASCADE,
 agent_key TEXT NOT NULL DEFAULT 'council-interviewer' CHECK(agent_key='council-interviewer'),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease_token TEXT, lease_expires_at INTEGER,
 output_json TEXT CHECK(output_json IS NULL OR json_valid(output_json)),
 error_code TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS runs_ready ON ai_runs(status,lease_expires_at,created_at);

CREATE TABLE IF NOT EXISTS agent_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 execution_id TEXT NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
 run_id TEXT REFERENCES ai_runs(id),
 event_type TEXT NOT NULL CHECK(event_type IN (
  'execution.queued','run.started','run.retry_scheduled','run.succeeded','run.failed','execution.completed')),
 payload_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload_json)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS events_cursor ON agent_events(execution_id,id);

-- The founder can review suggestions; a model cannot accept them.
CREATE TABLE IF NOT EXISTS module_proposals (
 id TEXT PRIMARY KEY NOT NULL,
 idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
 run_id TEXT NOT NULL REFERENCES ai_runs(id),
 module_type TEXT NOT NULL,
 content_json TEXT NOT NULL CHECK(json_valid(content_json)),
 base_module_version INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
 accepted_by TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS idea_modules (
 idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
 module_type TEXT NOT NULL,
 content_json TEXT NOT NULL CHECK(json_valid(content_json)),
 version INTEGER NOT NULL CHECK(version>0),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(idea_id,module_type)
);
CREATE TABLE IF NOT EXISTS idea_module_versions (
 idea_id TEXT NOT NULL,
 module_type TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 content_json TEXT NOT NULL CHECK(json_valid(content_json)),
 accepted_by TEXT NOT NULL,
 accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(idea_id,module_type,version),
 FOREIGN KEY(idea_id,module_type) REFERENCES idea_modules(idea_id,module_type)
);

-- Database-side transaction contract: one INSERT does everything or nothing.
-- The trigger enforces ownership and the CAS revision before new work is queued.
CREATE TRIGGER IF NOT EXISTS execution_guard BEFORE INSERT ON agent_executions
BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM ideas WHERE id=NEW.idea_id AND owner_id=NEW.owner_id
    AND revision=NEW.input_revision-1 AND revision<100
 ) THEN RAISE(ABORT,'STALE_REVISION_OR_OWNER') END;
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM agent_executions e WHERE e.idea_id=NEW.idea_id
   AND e.status IN ('queued','running')
 ) THEN RAISE(ABORT,'PENDING_RUN') END;
END;

CREATE TRIGGER IF NOT EXISTS execution_queued AFTER INSERT ON agent_executions
BEGIN
 UPDATE ideas SET revision=revision+1 WHERE id=NEW.idea_id;
 INSERT INTO interview_messages(id,idea_id,seq,role,content)
 VALUES(lower(hex(randomblob(16))),NEW.idea_id,NEW.input_revision*2-1,'founder',NEW.answer_content);
 UPDATE agent_executions SET input_snapshot=json_object(
  'ideaId',NEW.idea_id,'revision',NEW.input_revision,
  'title',(SELECT title FROM ideas WHERE id=NEW.idea_id),
  'history',json(COALESCE((SELECT json_group_array(json_object('role',role,'content',content))
    FROM (SELECT role,content FROM interview_messages
      WHERE idea_id=NEW.idea_id ORDER BY seq DESC LIMIT 24)),'[]')),
  'answer',NEW.answer_content
 ) WHERE id=NEW.id;
 INSERT INTO ai_runs(id,execution_id) VALUES(NEW.run_id,NEW.id);
 INSERT INTO agent_events(execution_id,run_id,event_type)
 VALUES(NEW.id,NEW.run_id,'execution.queued');
END;

CREATE TRIGGER IF NOT EXISTS run_started AFTER UPDATE OF status ON ai_runs
WHEN OLD.status != 'running' AND NEW.status='running'
BEGIN
 UPDATE agent_executions SET status='running' WHERE id=NEW.execution_id;
 INSERT INTO agent_events(execution_id,run_id,event_type)
 VALUES(NEW.execution_id,NEW.id,'run.started');
END;

CREATE TRIGGER IF NOT EXISTS run_completed AFTER UPDATE OF status ON ai_runs
WHEN OLD.status='running' AND NEW.status='succeeded'
BEGIN
 INSERT INTO interview_messages(id,idea_id,seq,role,content,run_id)
 SELECT lower(hex(randomblob(16))),e.idea_id,e.input_revision*2,'interviewer',
  json_extract(NEW.output_json,'$.next_question'),NEW.id
 FROM agent_executions e WHERE e.id=NEW.execution_id
  AND (SELECT revision FROM ideas WHERE id=e.idea_id)=e.input_revision
  AND json_valid(NEW.output_json)
  AND length(trim(json_extract(NEW.output_json,'$.next_question'))) BETWEEN 1 AND 1000;
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'INVALID_COMPLETION') END;
 UPDATE agent_executions SET status='succeeded' WHERE id=NEW.execution_id;
 INSERT INTO agent_events(execution_id,run_id,event_type,payload_json)
 VALUES(NEW.execution_id,NEW.id,'run.succeeded','{"persisted":true}');
 INSERT INTO agent_events(execution_id,run_id,event_type)
 VALUES(NEW.execution_id,NEW.id,'execution.completed');
END;

CREATE TRIGGER IF NOT EXISTS run_retry AFTER UPDATE OF status ON ai_runs
WHEN OLD.status='running' AND NEW.status IN ('queued','failed')
BEGIN
 UPDATE agent_executions SET status=NEW.status WHERE id=NEW.execution_id;
 INSERT INTO agent_events(execution_id,run_id,event_type,payload_json)
 VALUES(NEW.execution_id,NEW.id,
  CASE WHEN NEW.status='queued' THEN 'run.retry_scheduled' ELSE 'run.failed' END,
  json_object('code',NEW.error_code));
END;
