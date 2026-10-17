import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {workerDb} from '@/lib/supabase';
import {runInterviewer} from '@/lib/interviewer';
import {errorCode} from '@/lib/agent-core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

function authorized(request:NextRequest):boolean {
  const expected=process.env.WORKER_CRON_SECRET||'';
  const supplied=request.headers.get('x-worker-secret') ||
    (request.headers.get('authorization')?.replace(/^Bearer /,'')||'');
  if(expected.length<32 || !supplied) return false;
  const a=Buffer.from(expected),b=Buffer.from(supplied);
  return a.length===b.length && timingSafeEqual(a,b);
}
async function tick(request:NextRequest) {
  if(!authorized(request)) return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  if(!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({error:'WORKER_NOT_CONFIGURED'},{status:503});
  }
  try {
    const db=workerDb();
    const {data,error}=await db.rpc('claim_interviewer_run');
    if(error) throw error;
    const item=Array.isArray(data)?data[0]:null;
    if(!item) return NextResponse.json({claimed:false},{headers:{'Cache-Control':'no-store'}});
    const runId=item.run_id as string,lease=item.lease as string;
    try {
      const nextQuestion=await runInterviewer(item.snapshot);
      const completed=await db.rpc('complete_interviewer_run',{
        p_run:runId,p_lease:lease,p_next:nextQuestion
      });
      if(completed.error) throw completed.error;
      return NextResponse.json({claimed:true,completed:completed.data===true},
        {headers:{'Cache-Control':'no-store'}});
    }catch(error) {
      const code=errorCode(error);
      const failed=await db.rpc('fail_interviewer_run',{
        p_run:runId,p_lease:lease,p_code:code
      });
      if(failed.error) return NextResponse.json({error:'PERSISTENCE_FAILURE'},{status:503});
      return NextResponse.json({claimed:true,completed:false,error:code},{status:502});
    }
  }catch {return NextResponse.json({error:'WORKER_FAILURE'},{status:503});}
}
export const POST=tick;
// An authorized external scheduler can call GET with Bearer secret;
// no browser session or detached promise is used.
export const GET=tick;
