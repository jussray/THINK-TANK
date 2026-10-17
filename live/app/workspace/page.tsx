'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Idea={id:string;title:string;revision:number;created_at:string};
type Message={id:string;sequence:number;role:'founder'|'interviewer';content:string;created_at:string};
type Execution={id:string;status:string;input_revision:number;created_at:string};
type EventReceipt={id:number;event_type:string;created_at:string};
type Detail={idea:Idea;messages:Message[];executions:Execution[]};
type ExecutionDetail={execution:Execution;runs:{id:string;agent_key:string;status:string;attempts:number;error_code:string|null}[];events:EventReceipt[]};

const roles=[
  {name:'Interviewer',summary:'Adaptive follow-ups',live:true},
  {name:'Critic',summary:'Assumptions and dissent',live:false},
  {name:'Synthesizer',summary:'Proposed module updates',live:false},
  {name:'Scorecard',summary:'Evidence-aware rubric',live:false},
  {name:'Matchmaker',summary:'Verified resources',live:false}
];

function makeClient():SupabaseClient|null {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url&&key ? createClient(url,key) : null;
}
export default function Workspace(){
  const db=useMemo(makeClient,[]);
  const [loggedIn,setLoggedIn]=useState(false);
  const [booting,setBooting]=useState(true);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [authMode,setAuthMode]=useState<'login'|'signup'>('login');
  const [ideas,setIdeas]=useState<Idea[]>([]);
  const [ideaTitle,setIdeaTitle]=useState('');
  const [currentId,setCurrentId]=useState<string|null>(null);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [answer,setAnswer]=useState('');
  const [lastExecution,setLastExecution]=useState<ExecutionDetail|null>(null);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const requestRef=useRef<{ideaId:string;answer:string;key:string}|null>(null);

  const api=useCallback(async <T,>(path:string,options:RequestInit={}):Promise<T>=>{
    if(!db)throw Error('Backend is not configured.');
    const {data,error}=await db.auth.getSession();
    if(error || !data.session?.access_token)throw Error('Sign in required.');
    const response=await fetch(path,{
      ...options,
      headers:{Authorization:'Bearer '+data.session.access_token,
        ...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},
      cache:'no-store'
    });
    const body=await response.json();
    if(!response.ok)throw Error(body.error||'Request failed');
    return body as T;
  },[db]);

  const refreshIdeas=useCallback(async()=>{
    const result=await api<{ideas:Idea[]}>('/api/ideas');
    setIdeas(result.ideas||[]);
    return result.ideas||[];
  },[api]);
  const refreshDetail=useCallback(async(id:string)=>{
    const result=await api<Detail>('/api/ideas/'+encodeURIComponent(id));
    setDetail(result);
    return result;
  },[api]);
  const refreshExecution=useCallback(async(id:string)=>{
    const result=await api<ExecutionDetail>('/api/executions/'+encodeURIComponent(id));
    setLastExecution(result);
    return result;
  },[api]);

  useEffect(()=>{
    if(!db){setBooting(false);return;}
    let alive=true;
    db.auth.getSession().then(({data})=>{
      if(alive){setLoggedIn(Boolean(data.session));setBooting(false);}
    }).catch(()=>{if(alive)setBooting(false);});
    const {data:listener}=db.auth.onAuthStateChange((_event,session)=>{
      if(alive){setLoggedIn(Boolean(session));if(!session){setIdeas([]);setCurrentId(null);setDetail(null);setLastExecution(null);}}
    });
    return ()=>{alive=false;listener.subscription.unsubscribe();};
  },[db]);

  useEffect(()=>{
    if(!loggedIn)return;
    void refreshIdeas().catch(e=>setNotice(String(e)));
  },[loggedIn,refreshIdeas]);

  useEffect(()=>{
    if(!currentId || !loggedIn)return;
    let live=true;
    setLastExecution(null);setDetail(null);
    refreshDetail(currentId).then(result=>{
      if(!live)return;
      const newest=result.executions?.[0];
      if(newest)void refreshExecution(newest.id).catch(e=>setNotice(String(e)));
    }).catch(e=>setNotice(String(e)));
    return ()=>{live=false;};
  },[currentId,loggedIn,refreshDetail,refreshExecution]);

  // Poll persisted events: reconnect/reload works because the database owns status.
  useEffect(()=>{
    if(!currentId || !lastExecution || !['queued','running'].includes(lastExecution.execution.status))return;
    const id=lastExecution.execution.id;
    const timer=setInterval(()=>{
      void refreshExecution(id).then(state=>{
        if(['succeeded','failed','cancelled'].includes(state.execution.status))
          void refreshDetail(currentId).catch(e=>setNotice(String(e)));
      }).catch(e=>setNotice(String(e)));
    },3000);
    return ()=>clearInterval(timer);
  },[currentId,lastExecution?.execution.id,lastExecution?.execution.status,refreshDetail,refreshExecution]);

  async function auth(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!db)return;
    setBusy(true);setNotice('');
    try {
      const {error}=authMode==='signup'
        ? await db.auth.signUp({email,password})
        : await db.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(authMode==='signup')setNotice('Account request received. Check email if confirmation is required.');
    }catch(e){setNotice(e instanceof Error?e.message:'Authentication failed');}
    finally{setBusy(false);}
  }
  async function createIdea(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setNotice('');
    try{
      const result=await api<{idea:Idea}>('/api/ideas',{method:'POST',body:JSON.stringify({title:ideaTitle})});
      setIdeaTitle('');await refreshIdeas();setCurrentId(result.idea.id);
      setNotice('Idea saved to your account.');
    }catch(e){setNotice(e instanceof Error?e.message:'Could not save idea');}
    finally{setBusy(false);}
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!currentId||!answer.trim()||busy)return;
    const value=answer.trim();
    if(!requestRef.current||requestRef.current.ideaId!==currentId||requestRef.current.answer!==value){
      requestRef.current={ideaId:currentId,answer:value,key:crypto.randomUUID()};
    }
    setBusy(true);setNotice('');
    try{
      const result=await api<{executionId:string;status:string}>('/api/ideas/'+currentId+'/answer',{
        method:'POST',body:JSON.stringify({answer:value,idempotencyKey:requestRef.current.key})
      });
      requestRef.current=null;setAnswer('');
      await refreshDetail(currentId);await refreshExecution(result.executionId);
      await refreshIdeas();setNotice('Your answer is saved. Agent work is queued independently of this browser.');
    }catch(e){setNotice(e instanceof Error?e.message:'Submission failed');}
    finally{setBusy(false);}
  }
  return <div className="ambient">
    <header className="topbar"><Link href="/" className="logo">Think Tank<span>.</span></Link>
      <div className="row"><span className="eyebrow">Founder workspace</span>
      <Link href="/" className="outline">Home</Link>
      {loggedIn&&<button type="button" className="outline" onClick={()=>void db?.auth.signOut()}>Sign out</button>}
      </div></header>
    {!db?<main className="mainArea authPanel card"><p className="eyebrow">Configuration required</p>
      <h1 style={{fontSize:40}}>Connect the private backend.</h1>
      <p className="muted">No Supabase project is connected to this live application yet. This screen does not simulate accounts or AI output.</p>
      <Link className="outline" href="/">Return to landing</Link></main>:
    booting?<main className="mainArea" role="status">Loading account state…</main>:
    !loggedIn?<main className="mainArea"><div className="card authPanel">
      <p className="eyebrow">Private account access</p><h1 style={{fontSize:42}}>Your ideas have a home.</h1>
      <p className="muted">Sign in to recover your saved ideas and interviews across sessions.</p>
      <form onSubmit={auth}>
        <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <label htmlFor="password">Password</label><input id="password" type="password" autoComplete={authMode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/>
        <div className="row" style={{marginTop:18}}><button className="primary" type="submit" disabled={busy}>{authMode==='login'?'Sign in':'Create account'}</button>
          <button type="button" className="outline" onClick={()=>setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'Create an account':'I have an account'}</button></div>
      </form><p className="status" role="status">{notice}</p>
    </div></main>:
    <div className="workspaceShell">
      <aside className="sidebar">
        <p className="eyebrow">My ideas</p><form onSubmit={createIdea}><label htmlFor="newIdea">New idea</label>
          <textarea id="newIdea" aria-label="New idea" maxLength={4000} value={ideaTitle}
            onChange={e=>setIdeaTitle(e.target.value)} placeholder="What are you imagining?" required style={{minHeight:90}}/>
          <button type="submit" className="primary" disabled={busy||!ideaTitle.trim()}>Save idea +</button>
        </form>
        <hr style={{border:0,borderTop:'1px solid var(--line)',margin:'26px 0'}}/>
        {ideas.map(idea=><button key={idea.id} className={'ideaButton'+(currentId===idea.id?' active':'')} type="button"
           onClick={()=>{setCurrentId(idea.id);setNotice('');}}>{idea.title}<span className="small muted"> · r{idea.revision}</span></button>)}
        {!ideas.length&&<p className="muted">No account-backed ideas yet.</p>}
        <p className="note">Council and Court evaluate evidence, but do not authorize actions. Council Bus delivery remains blocked until its source and callbacks are verified.</p>
      </aside>
      <main className="mainArea">
        <p className="eyebrow">Interview · challenge · build</p>
        <h1 style={{fontSize:'clamp(34px,4.4vw,58px)',maxWidth:820,margin:'10px 0 14px'}}>Ideas deserve a deeper conversation.</h1>
        <p className="muted">Your words are saved before the model is called. You own the decisions.</p>
        <p className="status" role="status" aria-live="polite">{notice}</p>
        <div className="grid">
          <section className="card">
            <p className="eyebrow">01 / Adaptive interview</p>
            <h2>{detail?.idea.title||'Choose an idea to begin'}</h2>
            {detail&&<>
              <div className="messages" aria-label="Persisted interview messages" data-testid="messages">
                {(detail.messages||[]).map(msg=><div key={msg.id} className={'message '+msg.role}>
                   <span className="tag">{msg.role==='founder'?'FOUNDER':'INTERVIEWER'} · {msg.sequence}</span>
                   <div style={{whiteSpace:'pre-wrap'}}>{msg.content}</div></div>)}
                {!detail.messages?.length&&<p className="muted">Start the conversation with what you believe and what you still need to find out.</p>}
              </div>
              <form onSubmit={submit}><label htmlFor="answer">Your answer or next assumption</label>
                <textarea id="answer" value={answer} onChange={e=>setAnswer(e.target.value)}
                  maxLength={8000} required placeholder="Tell Think Tank what you know so far…" />
                <div className="row between" style={{marginTop:13}}>
                  <button type="submit" className="primary" disabled={busy||!answer.trim()||
                   ['queued','running'].includes(lastExecution?.execution.status||'')}>Submit and queue interviewer →</button>
                  <span className="pill">{detail.idea.revision} turns</span>
                </div>
              </form>
            </>}
            {!detail&&<div className="note">Choose a saved idea on the left. No fabricated interview transcript is displayed.</div>}
          </section>
          <div className="stack">
            <section className="card"><p className="eyebrow">Execution truth</p>
              <h3>{lastExecution?lastExecution.execution.status.toUpperCase():'No current run'}</h3>
              <p className="muted small">{lastExecution?'Events are read from the database, not a decorative animation.':'Submit an answer to create a durable run.'}</p>
              {(lastExecution?.runs||[]).map(run=><div key={run.id} className="note">
                <strong>{run.agent_key}</strong><div className="small">{run.status} · attempt {run.attempts}/3</div>
                {run.error_code&&<div className="small">{run.error_code}</div>}</div>)}
              <div className="stack">{(lastExecution?.events||[]).map(e=>
                <div key={e.id} className="row small"><span className="pill">#{e.id}</span><span>{e.event_type}</span></div>)}</div>
            </section>
            <section className="card"><p className="eyebrow">Five-role panel</p>
              <div className="orbList" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>
                {roles.map(role=><div key={role.name} className={'agent'+(role.live?'':' notConnected')}>
                  <div className="orb" aria-hidden="true"/><strong>{role.name}</strong>
                  <p className="small muted" style={{margin:'4px 0'}}>{role.summary}</p>
                  <span className="tag">{role.live?'Worker-configurable':'NOT CONNECTED'}</span>
                </div>)}
              </div>
            </section>
          </div>
        </div>
        <div className="note">A heuristic score is not proof of demand. Provider keys remain server-side. Account-backed persistence requires the dedicated Think Tank database migration and deployed worker scheduler.</div>
      </main>
    </div>}
  </div>;
}
