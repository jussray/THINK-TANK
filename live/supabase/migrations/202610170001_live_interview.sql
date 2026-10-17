-- Think Tank live V1: separate dedicated Supabase project only.
-- DO NOT apply to FCR or Se'kret Bip. Based on the archived June
-- ideas/interviews/modules contracts; the archive itself remains unchanged.
-- This migration is intentionally NOT applied until the owning Supabase
-- organization and project are confirmed.

create extension if not exists pgcrypto;

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 4000),
  revision integer not null default 0 check (revision between 0 and 1000),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index ideas_owner_idx on public.ideas(owner_id, created_at desc);

create table public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  role text not null check (role in ('founder','interviewer')),
  content text not null check (char_length(btrim(content)) between 1 and 8000),
  run_id uuid,
  created_at timestamptz not null default now(),
  unique (idea_id,sequence)
);
create unique index interview_one_question_per_run on public.interview_messages(run_id) where run_id is not null;

create table public.agent_executions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null,
  requested_by uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 12 and 128),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  input_revision integer not null,
  input_snapshot jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  created_at timestamptz not null default now(),
  unique (idea_id, requested_by, idempotency_key),
  unique (id, idea_id),
  foreign key (idea_id, requested_by) references public.ideas(id,owner_id) on delete cascade
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.agent_executions(id) on delete cascade,
  agent_key text not null check (agent_key in ('interviewer','synthesizer','critic','scorecard')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  lease_token uuid,
  lease_expires_at timestamptz,
  output jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  unique (execution_id, agent_key)
);
alter table public.interview_messages
  add constraint interview_run_fk foreign key (run_id) references public.ai_runs(id);

create table public.agent_events (
  id bigint generated always as identity primary key,
  execution_id uuid not null references public.agent_executions(id) on delete cascade,
  run_id uuid references public.ai_runs(id),
  event_type text not null check (event_type in
    ('execution.queued','run.started','run.retry_scheduled','run.succeeded','run.failed','execution.completed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index agent_events_cursor on public.agent_events(execution_id,id);

create table public.idea_modules (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  module_type text not null,
  content_json jsonb not null,
  version integer not null check (version > 0),
  source_run_id uuid references public.ai_runs(id),
  updated_at timestamptz not null default now(),
  primary key (idea_id,module_type)
);
create table public.idea_module_versions (
  idea_id uuid not null,
  module_type text not null,
  version integer not null check (version > 0),
  content_json jsonb not null,
  accepted_by uuid not null references auth.users(id),
  accepted_at timestamptz not null default now(),
  primary key (idea_id,module_type,version),
  foreign key (idea_id,module_type) references public.idea_modules(idea_id,module_type)
);
create table public.module_proposals (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  run_id uuid not null references public.ai_runs(id),
  module_type text not null,
  content_json jsonb not null,
  base_module_version integer not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index module_proposals_idea_idx on public.module_proposals(idea_id,status);

do $$
declare t text;
begin
  foreach t in array array['ideas','interview_messages','agent_executions','ai_runs','agent_events','idea_modules','idea_module_versions','module_proposals'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
  end loop;
end $$;

create policy ideas_select_owner on public.ideas for select to authenticated
  using (owner_id = (select auth.uid()));
create policy ideas_insert_owner on public.ideas for insert to authenticated
  with check (owner_id = (select auth.uid()));
grant select on public.ideas to authenticated;
grant insert (owner_id,title) on public.ideas to authenticated;

create policy messages_owner on public.interview_messages for select to authenticated
  using (exists (select 1 from public.ideas a where a.id=idea_id and a.owner_id=(select auth.uid())));
create policy executions_owner on public.agent_executions for select to authenticated
  using (requested_by=(select auth.uid()));
create policy runs_owner on public.ai_runs for select to authenticated
  using (exists(select 1 from public.agent_executions e where e.id=execution_id and e.requested_by=(select auth.uid())));
create policy events_owner on public.agent_events for select to authenticated
  using (exists(select 1 from public.agent_executions e where e.id=execution_id and e.requested_by=(select auth.uid())));
create policy modules_owner on public.idea_modules for select to authenticated
  using (exists(select 1 from public.ideas a where a.id=idea_id and a.owner_id=(select auth.uid())));
create policy versions_owner on public.idea_module_versions for select to authenticated
  using (exists(select 1 from public.ideas a where a.id=idea_id and a.owner_id=(select auth.uid())));
create policy proposals_owner on public.module_proposals for select to authenticated
  using (exists(select 1 from public.ideas a where a.id=idea_id and a.owner_id=(select auth.uid())));
grant select on public.interview_messages,public.agent_executions,public.ai_runs,
 public.agent_events,public.idea_modules,public.idea_module_versions,public.module_proposals to authenticated;
grant usage,select on sequence public.agent_events_id_seq to service_role;

-- Authenticated founder submits one answer, stores immutable input and queues
-- one run in the same database transaction. Function rechecks auth.uid().
create or replace function public.submit_interview_answer(
 p_idea_id uuid, p_content text, p_idempotency_key text, p_request_hash text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_revision integer; v_id uuid; v_hash text;
 v_run uuid; v_history jsonb;
begin
 if v_owner is null then raise exception 'UNAUTHORIZED' using errcode='28000'; end if;
 if char_length(btrim(p_content)) not between 1 and 8000 or
    char_length(p_idempotency_key) not between 12 and 128 or
    p_request_hash !~ '^[0-9a-f]{64}$'
 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select revision into v_revision from public.ideas
  where id=p_idea_id and owner_id=v_owner for update;
 if not found then raise exception 'NOT_FOUND' using errcode='22023'; end if;
 select id,request_hash into v_id,v_hash from public.agent_executions
  where idea_id=p_idea_id and requested_by=v_owner and idempotency_key=p_idempotency_key;
 if found then
   if v_hash != p_request_hash then
     raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505';
   end if;
   return v_id;
 end if;
 if v_revision >= 100 then raise exception 'INTERVIEW_LIMIT' using errcode='22023'; end if;
 if exists (select 1 from public.agent_executions e join public.ai_runs r on r.execution_id=e.id
   where e.idea_id=p_idea_id and r.status in ('queued','running'))
 then raise exception 'PENDING_RUN' using errcode='22023'; end if;
 insert into public.interview_messages(idea_id,sequence,role,content)
 values (p_idea_id,v_revision*2+1,'founder',btrim(p_content));
 update public.ideas set revision=revision+1 where id=p_idea_id;
 select coalesce(jsonb_agg(jsonb_build_object('role',role,'content',content) order by sequence),'[]'::jsonb)
   into v_history from (
     select role,content,sequence from public.interview_messages
      where idea_id=p_idea_id order by sequence desc limit 30
   ) history;
 insert into public.agent_executions
   (idea_id,requested_by,idempotency_key,request_hash,input_revision,input_snapshot)
 values (p_idea_id,v_owner,p_idempotency_key,p_request_hash,v_revision+1,
   jsonb_build_object('idea_id',p_idea_id,'revision',v_revision+1,
    'history',v_history,'answer',btrim(p_content)))
 returning id into v_id;
 insert into public.ai_runs(execution_id,agent_key) values(v_id,'interviewer')
 returning id into v_run;
 insert into public.agent_events(execution_id,run_id,event_type)
 values(v_id,v_run,'execution.queued');
 return v_id;
end $$;
revoke all on function public.submit_interview_answer(uuid,text,text,text) from public, anon;
grant execute on function public.submit_interview_answer(uuid,text,text,text) to authenticated;

-- Only a privileged worker can claim and finish tasks. Never exposed to browser.
create or replace function public.claim_interviewer_run()
returns table(run_id uuid, lease uuid, snapshot jsonb)
language plpgsql security definer set search_path='' as $$
declare picked record;
begin
 select r.id as rid,e.input_snapshot as input
 into picked from public.ai_runs r join public.agent_executions e on e.id=r.execution_id
 where r.agent_key='interviewer' and r.attempts < 3
   and (r.status='queued' or (r.status='running' and r.lease_expires_at<now()))
 order by r.created_at for update of r skip locked limit 1;
 if not found then return; end if;
 update public.ai_runs set status='running',attempts=attempts+1,
   lease_token=gen_random_uuid(),lease_expires_at=now()+interval '90 seconds'
 where id=picked.rid returning id,lease_token into run_id,lease;
 update public.agent_executions set status='running'
 where id=(select execution_id from public.ai_runs where id=run_id);
 insert into public.agent_events(execution_id,run_id,event_type)
 select execution_id,run_id,'run.started' from public.ai_runs where id=run_id;
 snapshot:=picked.input;return next;
end $$;
revoke all on function public.claim_interviewer_run() from public, anon, authenticated;
grant execute on function public.claim_interviewer_run() to service_role;

create or replace function public.complete_interviewer_run(p_run uuid,p_lease uuid,p_next text)
returns boolean language plpgsql security definer set search_path='' as $$
declare x record;
begin
 if p_next is null or char_length(btrim(p_next)) not between 1 and 1000 then
   raise exception 'INVALID_OUTPUT' using errcode='22023'; end if;
 select r.id,r.execution_id,e.idea_id,e.input_revision
 into x from public.ai_runs r join public.agent_executions e on e.id=r.execution_id
 where r.id=p_run and r.lease_token=p_lease and r.status='running'
   and r.lease_expires_at>now() for update of r;
 if not found then return false; end if;
 if (select revision from public.ideas where id=x.idea_id) != x.input_revision then
   raise exception 'STALE_SNAPSHOT' using errcode='40001'; end if;
 insert into public.interview_messages(idea_id,sequence,role,content,run_id)
 values(x.idea_id,x.input_revision*2,'interviewer',btrim(p_next),p_run);
 update public.ai_runs set status='succeeded',lease_token=null,lease_expires_at=null,
  output=jsonb_build_object('next_question',btrim(p_next)) where id=p_run;
 update public.agent_executions set status='succeeded' where id=x.execution_id;
 insert into public.agent_events(execution_id,run_id,event_type,payload)
 values(x.execution_id,p_run,'run.succeeded',jsonb_build_object('persisted',true)),
 (x.execution_id,p_run,'execution.completed','{}'::jsonb);
 return true;
end $$;
revoke all on function public.complete_interviewer_run(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.complete_interviewer_run(uuid,uuid,text) to service_role;

create or replace function public.fail_interviewer_run(p_run uuid,p_lease uuid,p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare x record; v_retry boolean;
begin
 select r.id,r.execution_id,r.attempts into x
 from public.ai_runs r where r.id=p_run and r.lease_token=p_lease
  and r.status='running' and r.lease_expires_at>now() for update;
 if not found then return false; end if;
 v_retry:=x.attempts < 3;
 update public.ai_runs set status=case when v_retry then 'queued' else 'failed' end,
   lease_token=null,lease_expires_at=null,
   error_code=left(coalesce(p_code,'PROVIDER_ERROR'),80) where id=p_run;
 update public.agent_executions set status=case when v_retry then 'queued' else 'failed' end
 where id=x.execution_id;
 insert into public.agent_events(execution_id,run_id,event_type,payload)
 values(x.execution_id,p_run,case when v_retry then 'run.retry_scheduled' else 'run.failed' end,
 jsonb_build_object('code',left(coalesce(p_code,'PROVIDER_ERROR'),80)));
 return true;
end $$;
revoke all on function public.fail_interviewer_run(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fail_interviewer_run(uuid,uuid,text) to service_role;
