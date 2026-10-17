import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) throw new Error('SUPABASE_NOT_CONFIGURED');
  return { url, publishable };
}
export function userClient(request: NextRequest): { db: SupabaseClient; bearer: string } {
  const {url, publishable} = config();
  const authHeader = request.headers.get('authorization') || '';
  if (!/^Bearer [^\s]+$/.test(authHeader)) throw new Error('UNAUTHORIZED');
  const bearer = authHeader.slice(7);
  const db = createClient(url, publishable, {
    auth: {persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{Authorization:'Bearer '+bearer}}
  });
  return {db,bearer};
}
export async function authenticated(request: NextRequest) {
  const {db,bearer}=userClient(request);
  // getUser(token) verifies via Supabase Auth service; never decode an
  // unverified JWT or use client-provided owner IDs.
  const {data,error}=await db.auth.getUser(bearer);
  if (error || !data.user) throw new Error('UNAUTHORIZED');
  return {db,userId:data.user.id};
}
export function workerDb() {
  const {url}=config();
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('WORKER_NOT_CONFIGURED');
  return createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
}
