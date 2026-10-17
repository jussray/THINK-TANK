import { assertQuestion, INTERVIEWER_SCHEMA } from './agent-core';

export async function runInterviewer(snapshot:unknown): Promise<string> {
  const key=process.env.OPENAI_API_KEY;
  const model=process.env.OPENAI_MODEL;
  if (!key || !model) throw new Error('MODEL_NOT_CONFIGURED');
  const signal=AbortSignal.timeout(25000);
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal,
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({
      model,
      max_output_tokens:220,
      store:false,
      instructions:'You are the Think Tank Interviewer. Ask exactly ONE concise, focused follow-up question based only on the founder-provided history. Never assert external research, sales, people, or outcomes. No grading, promises, or unverified market claims. Return only structured JSON.',
      input:JSON.stringify(snapshot),
      text:{format:{type:'json_schema',name:'interviewer_question',strict:true,schema:INTERVIEWER_SCHEMA}}
    })
  });
  if (!response.ok) throw new Error('PROVIDER_REJECTED');
  const body:unknown=await response.json();
  if (!body || typeof body!=='object') throw new Error('INVALID_PROVIDER_RESPONSE');
  const value=body as {status?:string;output?:Array<{content?:Array<{type?:string;text?:string;refusal?:string}>}>};
  if (value.status && value.status!=='completed') throw new Error('PROVIDER_INCOMPLETE');
  const content=(value.output||[]).flatMap(part=>part.content||[]);
  if (content.some(item=>item.type==='refusal'||item.refusal)) throw new Error('PROVIDER_REFUSED');
  const text=content.filter(item=>item.type==='output_text').map(item=>item.text||'').join('');
  if (!text) throw new Error('INVALID_PROVIDER_RESPONSE');
  let parsed:unknown;
  try { parsed=JSON.parse(text); } catch { throw new Error('INVALID_PROVIDER_RESPONSE'); }
  return assertQuestion(parsed);
}
