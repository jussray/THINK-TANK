# Think Tank — Foundation

Interview Engine + Idea Workspace. All future modules plug into this foundation without schema changes.

---

## Setup

### 1. Supabase

1. Create a new Supabase project at supabase.com
2. Enable the pgvector extension: **Project Settings → Database → Extensions → vector**
3. Run migrations in order:

```bash
# From the Supabase dashboard: SQL Editor → paste each file in order
supabase/migrations/001_profiles.sql
supabase/migrations/002_ideas.sql
supabase/migrations/003_interviews.sql
supabase/migrations/004_modules.sql
supabase/migrations/005_ai_memory.sql
supabase/migrations/006_ownership_ledger.sql
```

4. Copy your **Project URL**, **anon key**, and **service role key** from Project Settings → API

### 2. Clerk

1. Create a project at clerk.com
2. Enable Email + Google social login
3. In **Webhooks**: add endpoint `https://your-domain/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
4. Add the **Webhook Secret** to your env as `CLERK_WEBHOOK_SECRET`

### 3. AI Providers

- **Anthropic**: get API key at console.anthropic.com
- **OpenAI**: get API key at platform.openai.com (used for Critic Agent + embeddings)
- **Helicone**: sign up at helicone.ai — wraps all AI calls for cost/quality tracking

### 4. Environment

```bash
cp .env.example .env.local
# Fill in all values
```

### 5. Run

```bash
npm install
npm run dev
```

---

## Architecture

```
supabase/migrations/    — DB schema in dependency order
src/
  types/modules.ts      — All TypeScript types + MODULE_REGISTRY (plug-in surface)
  lib/
    ai/client.ts        — Single AI client import (Helicone-wrapped)
    agents/
      interview.ts      — Interview Agent: system prompt builder + concept map updater
      synthesis.ts      — Synthesis Agent: transcript → core modules
      critic.ts         — Critic Agent (GPT-4o) + Scorer Agent
    pipeline/
      post-session.ts   — Orchestrates all agents after session end
      memory.ts         — AI memory thread upserts + RAG retrieval
      versioning.ts     — Version snapshots + ledger entries
  server/
    trpc.ts             — tRPC server + context
    root.ts             — Root router
    routers/
      ideas.ts          — Idea CRUD
      interviews.ts     — Session management
      modules.ts        — Module read/write/poll
  app/
    api/
      interview/stream/ — Streaming interview route handler
      webhooks/clerk/   — Clerk → profiles sync
  components/
    IdeaWorkspace.tsx   — Full workspace UI
```

## Adding a New Module

1. Add its `content_json` shape to `src/types/modules.ts`
2. Add it to the `ModuleType` union
3. Add its config to `MODULE_REGISTRY`
4. Build its agent function in `src/lib/agents/`
5. Wire it into `post-session.ts`
6. Add its renderer to `IdeaWorkspace.tsx` → `ModuleContentRenderer`

Zero database changes. Zero schema migrations.

---

## Cost Targets

| Operation | Target cost |
|---|---|
| Full session (interview + synthesis + critic + scorer) | < $0.80 |
| Concept map update (per turn) | < $0.02 |
| Memory embedding (per session) | < $0.01 |
| Free tier budget (3 sessions/month) | < $2.50/user/month |

All costs tracked per-idea and per-agent in Helicone.
