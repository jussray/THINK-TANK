import { NextRequest,NextResponse } from 'next/server';
import { authenticated } from '@/lib/supabase';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if(!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:'INVALID_ID'},{status:400});
    const {db}=await authenticated(request);
    const [idea,messages,executions]=await Promise.all([
      db.from('ideas').select('id,title,revision,created_at').eq('id',id).maybeSingle(),
      db.from('interview_messages').select('id,sequence,role,content,created_at')
        .eq('idea_id',id).order('sequence',{ascending:true}).limit(210),
      db.from('agent_executions').select('id,status,input_revision,created_at')
        .eq('idea_id',id).order('created_at',{ascending:false}).limit(30)
    ]);
    if(idea.error||messages.error||executions.error) throw Error('DATABASE_ERROR');
    if(!idea.data) return NextResponse.json({error:'NOT_FOUND'},{status:404});
    return NextResponse.json({idea:idea.data,messages:messages.data,executions:executions.data},
       {headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error && error.message==='UNAUTHORIZED'?
    'UNAUTHORIZED':'REQUEST_FAILED'},{status:error instanceof Error && error.message==='UNAUTHORIZED'?401:503});}
}
