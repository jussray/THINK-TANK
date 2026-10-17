'use strict';
const $=id=>document.getElementById(id);
let ideas=[],activeId=null,detail=null,execution=null,pendingKey=null,pendingAnswer=null,busy=false;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function status(message){$('status').textContent=message;}
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n;}
function block(title,message){$('app').hidden=true;$('blocked').hidden=false;$('blocked-title').textContent=title;$('blocked-detail').textContent=message;}
async function api(path,init){
 const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...(init||{}),
  headers:{...((init&&init.body)?{'content-type':'application/json'}:{})}});
 if(!r.headers.get('content-type')?.includes('application/json'))throw Error('ACCESS_LOGIN_REQUIRED');
 const data=await r.json();
 if(!r.ok)throw Error(data.error||'REQUEST_FAILED');
 return data;
}
async function activate(id){
 activeId=id;execution=null;detail=null;
 for(const button of $('ideas').querySelectorAll('button'))button.classList.toggle('selected',button.dataset.id===id);
 const result=await api('/api/ideas/'+encodeURIComponent(id));
 detail=result;$('active-title').textContent=result.idea.title;
 $('revision').textContent=result.idea.revision+' turns';
 const container=$('messages');container.replaceChildren();
 for(const msg of result.messages){
  const article=el('article',undefined,'message '+msg.role);
  article.append(el('div',(msg.role==='founder'?'FOUNDER':'INTERVIEWER')+' · '+msg.sequence,'eyebrow'),
    el('p',msg.content));
  container.append(article);
 }
 if(!result.messages.length)container.append(el('p','Your questions and answers will appear here after saving.','muted'));
 if(result.executions?.length)await updateExecution(result.executions[0].id);
 else{setRunStatus('No active run');$('events').replaceChildren();$('council-findings').replaceChildren();$('court-verdict').textContent='Evidence not yet reviewed';}
 applyBusy();
}
function setRunStatus(text){$('run-status').textContent=text;}
async function updateExecution(id){
 const result=await api('/api/executions/'+encodeURIComponent(id));execution=result;
 setRunStatus((result.execution.status||'unknown').toUpperCase());
 const events=$('events');events.replaceChildren();
 for(const e of result.events){
  const row=el('div',undefined,'receipt');
  row.append(el('span','#'+e.id+' · '+e.event_type,'small'));events.append(row);
 }
 const output=result.runs?.[0]?.output||null;
 const council=$('council-findings');council.replaceChildren();
 if(output?.council&&output?.court){
  $('court-verdict').textContent='Court: '+output.court.verdict;
  for(const f of output.council.findings){
   const item=el('div',undefined,'receipt');
   item.append(el('strong',f.id),el('p',f.finding,'small'),el('span',f.providerState,'pill'));council.append(item);
  }
  for(const gap of output.court.gaps.slice(0,5))council.append(el('p','Gap: '+gap,'small muted'));
  $('transport').textContent='Council Bus: '+(output.busHandoff?.deliveryStatus||'NOT_CONNECTED');
 }else{
  $('court-verdict').textContent='Evidence not yet reviewed';
  $('transport').textContent='Council Bus: not connected';
 }
 applyBusy();
 return result;
}
function applyBusy(){
 const executing=execution&&['queued','running'].includes(execution.execution.status);
 $('submit').disabled=busy||!detail||Boolean(executing);
 $('create').querySelector('button').disabled=busy;
}
async function refreshIdeas(){
 const result=await api('/api/ideas');ideas=result.ideas;
 const container=$('ideas');container.replaceChildren();
 for(const idea of ideas){
  const button=el('button',idea.title+' · r'+idea.revision,'idea'+(idea.id===activeId?' selected':''));button.type='button';
  button.dataset.id=idea.id;button.addEventListener('click',()=>activate(idea.id).catch(e=>status(e.message)));container.append(button);
 }
 if(!ideas.length)container.append(el('p','No saved ideas yet. Start one above.','muted small'));
}
async function init(){
 try{
  await api('/api/me');
  $('blocked').hidden=true;$('app').hidden=false;status('Cloudflare Access authenticated. Your idea records are private to this account.');
  await refreshIdeas();if(ideas.length)await activate(ideas[0].id);
  setInterval(async()=>{
   try{
    if(execution&&['queued','running'].includes(execution.execution.status)){
     const next=await updateExecution(execution.execution.id);
     if(!['queued','running'].includes(next.execution.status)&&activeId)await activate(activeId);
    }
   }catch(e){status('Readback delayed: '+e.message);}
  },3500);
 }catch(e){
  const needsSetup=e.message==='ACCESS_NOT_CONFIGURED';
  block(needsSetup?'Account gate not configured':'Private sign-in required',
   needsSetup?'The Cloudflare Access application has not been attached and verified. No public account access is claimed.':
   'Sign in through the configured Cloudflare Access provider. This preview never falls back to anonymous access.');
  status(needsSetup?'Secure identity setup pending.':'Authentication required.');
 }
}
$('create').addEventListener('submit',async e=>{
 e.preventDefault();const title=$('title').value.trim();if(!title)return;
 busy=true;applyBusy();try{
  const result=await api('/api/ideas',{method:'POST',body:JSON.stringify({title})});
  $('title').value='';await refreshIdeas();await activate(result.idea.id);status('Idea saved in Cloudflare D1.');
 }catch(error){status('Could not save idea: '+error.message);}
 finally{busy=false;applyBusy();}
});
$('answer-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!activeId||busy)return;
 const answer=$('answer').value.trim();if(!answer)return;
 if(answer!==pendingAnswer){pendingKey=crypto.randomUUID();pendingAnswer=answer;}
 busy=true;applyBusy();try{
  const result=await api('/api/ideas/'+activeId+'/answer',{method:'POST',
   body:JSON.stringify({answer,idempotencyKey:pendingKey})});
  pendingAnswer=null;pendingKey=null;$('answer').value='';
  await refreshIdeas();await activate(activeId);await updateExecution(result.executionId);
  status('Answer saved. Council Interviewer queued independently of this browser.');
 }catch(error){status('Submission held: '+error.message);}
 finally{busy=false;applyBusy();}
});
$('export').addEventListener('click',()=>{
 if(!detail)return status('Choose an idea first.');
 const output={format:'think-tank-d1-export-v1',exportedAt:new Date().toISOString(),
  idea:detail.idea,interview:detail.messages,executionSummary:detail.executions};
 const file=new Blob([JSON.stringify(output,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(file),a=el('a');a.href=url;a.download='think-tank-'+detail.idea.id+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 status('Portable local backup exported. This is not a cryptographic ownership certificate.');
});
void init();
