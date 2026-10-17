"""Reproducible SQLite/D1 transaction tests, no credentials or network needed."""
import sqlite3
import pathlib
import json
import unittest

SCHEMA=pathlib.Path(__file__).resolve().parents[1] / "migrations/0001_initial.sql"
IDEA="00000000-0000-4000-8000-000000000001"
RUN="00000000-0000-4000-8000-000000000003"
EXEC="00000000-0000-4000-8000-000000000002"

def setup():
    db=sqlite3.connect(":memory:")
    db.row_factory=sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript(SCHEMA.read_text())
    db.execute("INSERT INTO ideas(id,owner_id,title) VALUES(?,?,?)",(IDEA,"founder-one","Testing customer demand"))
    return db

def submit(db, *, owner="founder-one", key="unique-founder-key-1", run=RUN, execution=EXEC, rev=1, digest="a"*64):
    return db.execute(
       "INSERT INTO agent_executions(id,idea_id,owner_id,idempotency_key,request_hash,run_id,answer_content,input_revision) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(idea_id,owner_id,idempotency_key) DO NOTHING",
       (execution,IDEA,owner,key,digest,run,"My customers might pay.",rev))

class TestD1Contract(unittest.TestCase):
    def test_atomic_answer_snapshot_queue_and_event(self):
        db=setup()
        submit(db)
        self.assertEqual(db.execute("SELECT revision FROM ideas WHERE id=?",(IDEA,)).fetchone()[0],1)
        self.assertEqual(db.execute("SELECT count(*) FROM interview_messages").fetchone()[0],1)
        self.assertEqual(db.execute("SELECT count(*) FROM agent_events").fetchone()[0],1)
        result=json.loads(db.execute("SELECT input_snapshot FROM agent_executions").fetchone()[0])
        self.assertEqual(result["revision"],1)
        self.assertEqual(result["history"][0]["role"],"founder")
        self.assertEqual(db.execute("SELECT status FROM ai_runs").fetchone()[0],"queued")

    def test_idempotent_retry_does_not_duplicate(self):
        db=setup()
        submit(db)
        submit(db,run="00000000-0000-4000-8000-000000000004",execution="00000000-0000-4000-8000-000000000005")
        self.assertEqual(db.execute("SELECT count(*) FROM agent_executions").fetchone()[0],1)
        self.assertEqual(db.execute("SELECT revision FROM ideas").fetchone()[0],1)

    def test_cross_owner_and_stale_revision_fail_closed(self):
        for owner,rev in [("intruder",1),("founder-one",2)]:
            db=setup()
            with self.assertRaises(sqlite3.IntegrityError):
                submit(db,owner=owner,rev=rev)
            self.assertEqual(db.execute("SELECT count(*) FROM agent_executions").fetchone()[0],0)
            self.assertEqual(db.execute("SELECT revision FROM ideas").fetchone()[0],0)

    def test_only_one_pending_execution_per_idea(self):
        db=setup();submit(db)
        with self.assertRaises(sqlite3.IntegrityError):
            submit(db,key="unique-founder-key-2",run="00000000-0000-4000-8000-000000000004",execution="00000000-0000-4000-8000-000000000005",rev=2)
        self.assertEqual(db.execute("SELECT revision FROM ideas").fetchone()[0],1)

    def test_completion_trigger_inserts_exactly_one_question_and_receipts(self):
        db=setup();submit(db)
        db.execute("UPDATE ai_runs SET status='running',attempts=1,lease_token='lease-one',lease_expires_at=9999999999999 WHERE id=?",(RUN,))
        output=json.dumps({"next_question":"Who actually paid you?","council":{"fingerprint":"record"},"court":{"verdict":"HOLD"}})
        db.execute("UPDATE ai_runs SET status='succeeded',output_json=?,lease_token=NULL WHERE id=?",(output,RUN))
        rows=db.execute("SELECT seq,role,content FROM interview_messages ORDER BY seq").fetchall()
        self.assertEqual([(r["seq"],r["role"]) for r in rows],[(1,"founder"),(2,"interviewer")])
        self.assertEqual(rows[1]["content"],"Who actually paid you?")
        self.assertEqual([r[0] for r in db.execute("SELECT event_type FROM agent_events ORDER BY id")],
             ["execution.queued","run.started","run.succeeded","execution.completed"])
        self.assertEqual(db.execute("SELECT status FROM agent_executions").fetchone()[0],"succeeded")

    def test_empty_model_question_aborts_all_completion_mutations(self):
        db=setup();submit(db)
        db.execute("UPDATE ai_runs SET status='running',attempts=1,lease_token='lease-one' WHERE id=?",(RUN,))
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("UPDATE ai_runs SET status='succeeded',output_json=? WHERE id=?",(json.dumps({"next_question":""}),RUN))
        self.assertEqual(db.execute("SELECT status FROM ai_runs").fetchone()[0],"running")
        self.assertEqual(db.execute("SELECT count(*) FROM interview_messages").fetchone()[0],1)

    def test_retry_and_failure_write_events(self):
        db=setup();submit(db)
        db.execute("UPDATE ai_runs SET status='running',attempts=1,lease_token='lease-one' WHERE id=?",(RUN,))
        db.execute("UPDATE ai_runs SET status='queued',lease_token=NULL,error_code='AGENT_FAILED' WHERE id=?",(RUN,))
        self.assertIn("run.retry_scheduled",[r[0] for r in db.execute("SELECT event_type FROM agent_events")])
        db.execute("UPDATE ai_runs SET status='running',attempts=3,lease_token='lease-two' WHERE id=?",(RUN,))
        db.execute("UPDATE ai_runs SET status='failed',lease_token=NULL,error_code='AGENT_FAILED' WHERE id=?",(RUN,))
        self.assertEqual(db.execute("SELECT status FROM agent_executions").fetchone()[0],"failed")
        self.assertIn("run.failed",[r[0] for r in db.execute("SELECT event_type FROM agent_events")])

if __name__=="__main__":
    unittest.main()
