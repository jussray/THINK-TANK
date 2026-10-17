import { NextRequest, NextResponse } from 'next/server';
import { authenticated } from '@/lib/supabase';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest) {
  try {
    const {db}=await authenticated(request);
    const {data,error}=await db.from('ideas').select('id,title,revision,created_at')
      .order('created_at',{ascending:false}).limit(100);
    if(error) throw error;
    return NextResponse.json({ideas:data},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return denied(error);}
}
export async function POST(request:NextRequest) {
  try {
    const {db,userId}=await authenticated(request);
    const payload=await request.json();
    if(!payload || typeof payload.title!=='string' || payload.title.trim().length<1 ||
       payload.title.trim().length>4000) return NextResponse.json({error:'INVALID_TITLE'},{status:400});
    const {data,error}=await db.from('ideas').insert({title:payload.title.trim(),owner_id:userId})
      .select('id,title,revision,created_at').single();
    if(error) throw error;
    return NextResponse.json({idea:data},{status:201,headers:{'Cache-Control':'no-store'}});
  } catch(error) {return denied(error);}
}
function denied(error:unknown) {
  return NextResponse.json({error:error instanceof Error && error.message==='UNAUTHORIZED'
    ? 'UNAUTHORIZED' : error instanceof Error && error.message==='SUPABASE_NOT_CONFIGURED'
    ? 'NOT_CONFIGURED' : 'REQUEST_FAILED'},
    {status:error instanceof Error && error.message==='UNAUTHORIZED'?401:503});
}
