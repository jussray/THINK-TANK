/**
 * Production-shaped AI gateway for the existing Supabase-authenticated public
 * Worker. All gates are fail-closed; deployed AI is disabled until configured.
 *
 * The caller must supply the verified Supabase session and a server-side,
 * user-scoped vault reader. Never trust a client-submitted idea or history.
 * The AI has no write authority: drafts require founder review.
 */
import { interviewTurn } from '../revival/ai/interview-engine.mjs';
import { generateDraftPackage } from '../revival/ai/synthesis-engine.mjs';
import { createAnthropicProvider } from '../revival/ai/anthropic-provider.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_PATHS=new Set(['/api/ai/interview','/api/ai/synthesize']);

function validRecord(row, id, userId) {
  const record=row?.record;
  return row?.id===id && row.owner_user_id===userId &&
    record?.schemaVersion==='IdeaRecordV1' && record.id===id &&
    typeof record.idea==='string' && record.idea.trim().length>0 &&
    record.idea.length<=4000 && Array.isArray(record.answers) &&
    record.answers.length<=50;
}

export async function handleAiAction({pathname,body,session,env,upstream,reply}) {
  if (!VALID_PATHS.has(pathname)) return reply({error:'Not found'},404);
  if (!session?.user?.id || !session.token) return reply({error:'Sign in required'},401);
  if (body?.externalAIConsent!==true) return reply({error:'External AI consent required for this request'},403);
  if (typeof body.ideaId!=='string' || !UUID.test(body.ideaId)) return reply({error:'Invalid idea ID'},400);
  if (pathname==='/api/ai/interview' && (body.answer!==undefined &&
      (typeof body.answer!=='string' || body.answer.trim().length===0 || body.answer.length>8000))) {
    return reply({error:'Invalid interview answer'},400);
  }
  // Do not accept client-submitted transcripts or draft modules.
  if (body.history!==undefined || body.record!==undefined || body.modules!==undefined) {
    return reply({error:'Unsupported AI input'},400);
  }
  if (env.THINK_TANK_AI_ENABLED!=='true') return reply({error:'External AI is disabled'},503);
  if (!env.AI_RATE_LIMIT || typeof env.AI_RATE_LIMIT.limit!=='function' ||
      typeof env.ANTHROPIC_API_KEY!=='string' || !env.ANTHROPIC_API_KEY ||
      typeof env.THINK_TANK_AI_MODEL!=='string' || !env.THINK_TANK_AI_MODEL.trim()) {
    return reply({error:'AI service is not configured'},503);
  }

  // Owner isolation is enforced by the existing verified Supabase bearer and
  // explicit owner filter. No service role or unrelated record is involved.
  const query=new URLSearchParams({
    select:'id,owner_user_id,record,revision', id:'eq.'+body.ideaId,
    owner_user_id:'eq.'+session.user.id, limit:'1'
  });
  const fetched=await upstream(env,'/rest/v1/think_tank_idea_records?'+query,'GET',undefined,session.token);
  if (!fetched.ok || !Array.isArray(fetched.body)) return reply({error:'Private idea vault unavailable'},503);
  const row=fetched.body[0];
  if (!validRecord(row,body.ideaId,session.user.id)) return reply({error:'Idea not found'},404);

  // Per-user Cloudflare rate-limit binding: no configured budget gate = no AI.
  // This location-scoped limiter is NOT a guaranteed global spend ceiling.
  const limiter=await env.AI_RATE_LIMIT.limit({key:session.user.id});
  if (!limiter?.success) return reply({error:'AI request limit reached'},429);

  const provider=createAnthropicProvider({
    apiKey:env.ANTHROPIC_API_KEY,
    model:env.THINK_TANK_AI_MODEL,
    maxTokens:pathname==='/api/ai/synthesize'?4000:260,
    fetcher:globalThis.fetch
  });
  const record=row.record;
  try {
    if (pathname==='/api/ai/synthesize') {
      const draft=await generateDraftPackage({record,externalAIConsent:true},provider);
      return reply({...draft,sourceVaultRevision:row.revision},200,session.set);
    }
    const history=record.answers.flatMap(a=>[
      {role:'assistant',content:a.question},{role:'user',content:a.answer}
    ]);
    const turn=await interviewTurn({
      record,history,answer:body.answer??null,externalAIConsent:true
    },provider);
    return reply({...turn,sourceVaultRevision:row.revision},200,session.set);
  } catch {
    return reply({error:'AI provider request failed; no idea was modified'},502);
  }
}
