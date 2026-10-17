import {NextRequest,NextResponse} from 'next/server';
import {authenticated} from '@/lib/supabase';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if(!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:'INVALID_ID'},{status:400});
    const {db}=await authenticated(request);
    const {data:execution,error}=await db.from('agent_executions')
      .select('id,idea_id,status,input_revision,created_at').eq('id',id).maybeSingle();
    if(error) throw error;
    if(!execution) return NextResponse.json({error:'NOT_FOUND'},{status:404});
    const [runs,events]=await Promise.all([
      db.from('ai_runs').select('id,agent_key,status,attempts,error_code').eq('execution_id',id),
      db.from('agent_events').select('id,event_type,payload,created_at')
        .eq('execution_id',id).order('id',{ascending:true}).limit(500)
    ]);
    if(runs.error||events.error) throw Error('DATABASE_ERROR');
    return NextResponse.json({execution,runs:runs.data,events:events.data},
      {headers:{'Cache-Control':'no-store'}});
  }catch(error){const unauthorized=error instanceof Error && error.message==='UNAUTHORIZED';
    return NextResponse.json({error:unauthorized?'UNAUTHORIZED':'REQUEST_FAILED'},
      {status:unauthorized?401:503});}
}
