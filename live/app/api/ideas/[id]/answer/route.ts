import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {authenticated} from '@/lib/supabase';
import {AnswerSchema,requestFingerprint} from '@/lib/agent-core';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if(!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:'INVALID_ID'},{status:400});
    const {db}=await authenticated(request);
    const parsed=AnswerSchema.safeParse(await request.json());
    if(!parsed.success) return NextResponse.json({error:'INVALID_ANSWER'},{status:400});
    const {answer,idempotencyKey}=parsed.data;
    const digest=createHash('sha256').update(requestFingerprint(id,answer)).digest('hex');
    const {data,error}=await db.rpc('submit_interview_answer',{
      p_idea_id:id,p_content:answer,p_idempotency_key:idempotencyKey,p_request_hash:digest
    });
    if(error) {
      const conflict=/IDEMPOTENCY_CONFLICT|PENDING_RUN/.test(error.message||'');
      return NextResponse.json({error:conflict?'CONFLICT':'SUBMISSION_REFUSED'},
        {status:conflict?409:400});
    }
    return NextResponse.json({executionId:data,status:'queued'},
      {status:202,headers:{'Cache-Control':'no-store'}});
  }catch(error){const unauthorized=error instanceof Error && error.message==='UNAUTHORIZED';
    return NextResponse.json({error:unauthorized?'UNAUTHORIZED':'REQUEST_FAILED'},
      {status:unauthorized?401:503});}
}
