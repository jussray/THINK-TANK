import {verifyFounderAccess} from './access.mjs';
import {runCouncilIntelligence} from './council-intelligence.mjs';
import {embeddedAssetResponse} from './embedded-assets.mjs';

const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern=/^[a-zA-Z0-9_-]{12,128}$/;
function json(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}});
}
function records(data){return data?.results||[];}
function errorResponse(error){
 if(error?.status===401)return json({error:'UNAUTHORIZED'},401);
 if(error?.status===503)return json({error:'ACCESS_NOT_CONFIGURED'},503);
 if(/PENDING_RUN|STALE_REVISION|UNIQUE constraint failed/i.test(error?.message||''))return json({error:'CONFLICT'},409);
 if(/DAILY_LIMIT|INTERVIEW_LIMIT/i.test(error?.message||''))return json({error:'LIMIT_REACHED'},429);
 return json({error:'REQUEST_FAILED'},503);
}
async function readBody(request){
 const size=Number(request.headers.get('content-length')||0);
 if(size>15000)throw Object.assign(Error('TOO_LARGE'),{status:400});
 const obj=await request.json();
 if(JSON.stringify(obj).length>15000)throw Object.assign(Error('TOO_LARGE'),{status:400});
 return obj;
}
async function digest(text){
 const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(raw)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function route(request,env,owner){
 const {pathname}=new URL(request.url),method=request.method;
 if(pathname==='/api/me'&&method==='GET')
  return json({authenticated:true,provider:'cloudflare-access',scope:'think-tank'});
 if(pathname==='/api/ideas'){
  if(method==='GET'){
   const d=await env.DB.prepare('SELECT id,title,revision,created_at FROM ideas WHERE owner_id=? ORDER BY created_at DESC LIMIT 100').bind(owner).all();
   return json({ideas:records(d)});
  }
  if(method==='POST'){
   const body=await readBody(request);
   if(typeof body?.title!=='string'||!body.title.trim()||body.title.trim().length>4000)
    return json({error:'INVALID_TITLE'},400);
   const count=await env.DB.prepare('SELECT count(*) AS n FROM ideas WHERE owner_id=?').bind(owner).first();
   if(count.n>=100)return json({error:'IDEA_LIMIT'},429);
   const id=crypto.randomUUID();
   await env.DB.prepare('INSERT INTO ideas(id,owner_id,title) VALUES(?,?,?)').bind(id,owner,body.title.trim()).run();
   const idea=await env.DB.prepare('SELECT id,title,revision,created_at FROM ideas WHERE id=? AND owner_id=?').bind(id,owner).first();
   return json({idea},201);
  }
 }
 const match=pathname.match(/^\/api\/ideas\/([0-9a-f-]{36})(?:\/(answer))?$/i);
 if(match&&idPattern.test(match[1])){
  const ideaId=match[1];
  if(!match[2]&&method==='GET'){
   const idea=await env.DB.prepare('SELECT id,title,revision,created_at FROM ideas WHERE id=? AND owner_id=?').bind(ideaId,owner).first();
   if(!idea)return json({error:'NOT_FOUND'},404);
   const messages=await env.DB.prepare('SELECT id,seq AS sequence,role,content,created_at FROM interview_messages WHERE idea_id=? ORDER BY seq LIMIT 201').bind(ideaId).all();
   const executions=await env.DB.prepare('SELECT id,status,input_revision,created_at FROM agent_executions WHERE idea_id=? AND owner_id=? ORDER BY created_at DESC LIMIT 30').bind(ideaId,owner).all();
   return json({idea,messages:records(messages),executions:records(executions)});
  }
  if(match[2]==='answer'&&method==='POST'){
   const idea=await env.DB.prepare('SELECT id,revision FROM ideas WHERE id=? AND owner_id=?').bind(ideaId,owner).first();
   if(!idea)return json({error:'NOT_FOUND'},404);
   const body=await readBody(request);
   const answer=typeof body?.answer==='string'?body.answer.trim():'',key=body?.idempotencyKey;
   if(!answer||answer.length>8000||typeof key!=='string'||!keyPattern.test(key))
    return json({error:'INVALID_ANSWER'},400);
   const hash=await digest(JSON.stringify({v:1,ideaId,answer}));
   const previous=await env.DB.prepare('SELECT id,request_hash,status FROM agent_executions WHERE idea_id=? AND owner_id=? AND idempotency_key=?')
     .bind(ideaId,owner,key).first();
   if(previous)return previous.request_hash===hash
     ?json({executionId:previous.id,status:previous.status,idempotent:true},202)
     :json({error:'IDEMPOTENCY_CONFLICT'},409);
   const executionId=crypto.randomUUID(),runId=crypto.randomUUID();
   // A single statement + its D1 triggers atomically commits answer, revision,
   // input snapshot, queued run and first event. Trigger rejects stale revision.
   await env.DB.prepare(
    'INSERT INTO agent_executions (id,idea_id,owner_id,idempotency_key,request_hash,run_id,answer_content,input_revision) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(idea_id,owner_id,idempotency_key) DO NOTHING'
   ).bind(executionId,ideaId,owner,key,hash,runId,answer,idea.revision+1).run();
   const stored=await env.DB.prepare('SELECT id,request_hash FROM agent_executions WHERE idea_id=? AND owner_id=? AND idempotency_key=?')
    .bind(ideaId,owner,key).first();
   if(!stored)return json({error:'SUBMISSION_FAILED'},503);
   if(stored.request_hash!==hash)return json({error:'IDEMPOTENCY_CONFLICT'},409);
   return json({executionId:stored.id,status:stored.status,idempotent:stored.id!==executionId},202);
  }
 }
 const exec=pathname.match(/^\/api\/executions\/([0-9a-f-]{36})$/i);
 if(exec&&idPattern.test(exec[1])&&method==='GET'){
  const e=await env.DB.prepare('SELECT id,idea_id,status,input_revision,created_at FROM agent_executions WHERE id=? AND owner_id=?')
   .bind(exec[1],owner).first();
  if(!e)return json({error:'NOT_FOUND'},404);
  const runs=await env.DB.prepare('SELECT id,agent_key,status,attempts,error_code,output_json FROM ai_runs WHERE execution_id=?').bind(exec[1]).all();
  const events=await env.DB.prepare('SELECT id,event_type,payload_json,created_at FROM agent_events WHERE execution_id=? ORDER BY id LIMIT 300').bind(exec[1]).all();
  return json({execution:e,
   runs:records(runs).map(x=>({id:x.id,agent_key:x.agent_key,status:x.status,attempts:x.attempts,error_code:x.error_code,
    output:x.output_json?JSON.parse(x.output_json):null})),
   events:records(events).map(x=>({id:x.id,event_type:x.event_type,created_at:x.created_at,
    payload:x.payload_json?JSON.parse(x.payload_json):{}}))});
 }
 return json({error:'NOT_FOUND'},404);
}
export async function claimRun(env){
 const at=Date.now(),lease=crypto.randomUUID();
 return env.DB.prepare(
  "UPDATE ai_runs SET status='running',attempts=attempts+1,lease_token=?,lease_expires_at=? WHERE id=(SELECT id FROM ai_runs WHERE (status='queued' OR (status='running' AND lease_expires_at<?)) AND attempts<3 ORDER BY created_at,id LIMIT 1) AND (status='queued' OR (status='running' AND lease_expires_at<?)) RETURNING id,execution_id,lease_token,attempts"
 ).bind(lease,at+90000,at,at).first();
}
export async function tick(env){
 if(!env.DB)throw Error('D1_NOT_CONFIGURED');
 if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)return {claimed:false,error:'MODEL_NOT_CONFIGURED'};
 await env.DB.prepare(
  "UPDATE ai_runs SET status='failed',error_code='LEASE_EXPIRED',lease_token=NULL,lease_expires_at=NULL WHERE status='running' AND attempts>=3 AND lease_expires_at<?"
 ).bind(Date.now()).run();
 const run=await claimRun(env);
 if(!run)return {claimed:false};
 const e=await env.DB.prepare('SELECT idea_id,input_revision,input_snapshot FROM agent_executions WHERE id=?')
  .bind(run.execution_id).first();
 if(!e)throw Error('ORPHAN_EXECUTION');
 try{
  const output=await runCouncilIntelligence(JSON.parse(e.input_snapshot),env,
   {runId:run.id,executionId:run.execution_id,ideaId:e.idea_id});
  const result=await env.DB.prepare(
   "UPDATE ai_runs SET status='succeeded',output_json=?,lease_token=NULL,lease_expires_at=NULL WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>? AND EXISTS (SELECT 1 FROM agent_executions e JOIN ideas i ON i.id=e.idea_id WHERE e.id=ai_runs.execution_id AND e.input_revision=i.revision) RETURNING id"
  ).bind(JSON.stringify(output),run.id,run.lease_token,Date.now()).first();
  return {claimed:true,completed:Boolean(result)};
 }catch(error){
  const allowed=['MODEL_INCOMPLETE','MODEL_REFUSED','INVALID_STRUCTURED_OUTPUT',
   'PROVIDER_REJECTED','MODEL_NOT_CONFIGURED','SNAPSHOT_TOO_LARGE','COUNCIL_CONTRACT_MISMATCH'];
  const code=allowed.includes(error?.message)?error.message:'AGENT_FAILED';
  const state=run.attempts<3?'queued':'failed';
  await env.DB.prepare(
   "UPDATE ai_runs SET status=?,error_code=?,lease_token=NULL,lease_expires_at=NULL WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>?"
  ).bind(state,code,run.id,run.lease_token,Date.now()).run();
  return {claimed:true,completed:false,error:code};
 }
}
export default {
 async fetch(request,env){
  const pathname=new URL(request.url).pathname;
  if(pathname==='/health'&&request.method==='GET')
   return json({service:'think-tank',runtime:'cloudflare-d1-council',status:'preview'});
  if(pathname.startsWith('/api/')){
   try{
    if(!env.DB)return json({error:'D1_NOT_CONFIGURED'},503);
    const owner=await verifyFounderAccess(request,env);
    return await route(request,env,owner);
   }catch(error){
    if(error?.status===400)return json({error:'INVALID_REQUEST'},400);
    return errorResponse(error);
   }
  }
  let response=null;
  if(env.ASSETS)response=await env.ASSETS.fetch(request);
  else response=embeddedAssetResponse(request);
  if(response){
   const headers=new Headers(response.headers);
   headers.set('content-security-policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
   headers.set('referrer-policy','no-referrer');
   headers.set('x-content-type-options','nosniff');
   headers.set('x-frame-options','DENY');
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  return json({error:'ASSETS_NOT_CONFIGURED'},503);
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(tick(env));}
};
