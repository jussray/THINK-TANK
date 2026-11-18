const EXPORT_FORMAT='think-tank-export-v1';
const MAX_IMPORT_BYTES=1_000_000;
const QUESTIONS=[
  'Who is paying for this, specifically, and what painful job are they hiring it to do?',
  'What do they use today instead of you?',
  'What is the smallest reason they would switch this month?',
  'What would make this hard to copy if it starts working?'
];
const $=id=>document.getElementById(id);
const C=ThinkTankPolicy.CAPABILITY;
const capabilityPolicy=new ThinkTankPolicy.LocalCapabilityPolicy();
const capabilitiesPromise=capabilityPolicy.capabilitiesFor({kind:'local-founder'});
const ideaStore=new ThinkTankStores.LocalIdeaStore();
const ideaReadModel=ideaStore;
let record=null;
let questionIndex=0;
let pivotRequested=false;
function now(){return new Date().toISOString()}
function setPortabilityStatus(message){$('portabilityStatus').textContent=message}
function errorMessage(error){return error instanceof Error?error.message:'invalid record'}
async function requireCapability(capability){const capabilities=await capabilitiesPromise;if(!ThinkTankPolicy.can(capabilities,capability))throw new Error(`Capability unavailable: ${capability}`);return capabilities}
async function runCapability(capability,action){try{await requireCapability(capability);return await action()}catch(error){setPortabilityStatus(`Action refused: ${errorMessage(error)}`)}}
async function save(){record=await ideaStore.saveCurrent(record);await renderRecord()}
async function load(){try{return await ideaReadModel.loadCurrent()}catch(error){setPortabilityStatus(`Stored Idea Record refused: ${errorMessage(error)}`);return null}}
function showInterviewMode(on,idea=''){$('setup').classList.toggle('hidden',on);$('startSummary').classList.toggle('hidden',!on);$('startIdea').textContent=on?idea:'';$('interviewIdle').classList.toggle('hidden',on);$('conversation').classList.toggle('hidden',!on)}
function addMessage(role,text){const node=document.createElement('div');node.className=`msg ${role.toLowerCase()}`;const roleNode=document.createElement('div');roleNode.className='role';roleNode.textContent=role;const textNode=document.createElement('div');textNode.textContent=text;node.append(roleNode,textNode);$('transcript').appendChild(node);$('transcript').scrollTop=$('transcript').scrollHeight}
async function finish(){await requireCapability(C.ANALYSIS_RUN);const assessment=ThinkTankDomain.assessIdea(record);record.scorecard=assessment.scorecard;record.critique=assessment.critique;record.modules=assessment.modules;record.pattern=assessment.pattern;record.status='complete';record.updatedAt=now();const version={schemaVersion:ThinkTankContracts.SCHEMA.IDEA_VERSION,version:record.versions.length+1,createdAt:now(),idea:record.idea,scorecard:record.scorecard,modules:record.modules};record.versions.push(version);await save();addMessage('CRITIC',record.critique);addMessage('SCORECARD',`Market ${record.scorecard.market}/10 · Differentiation ${record.scorecard.differentiation}/10 · Timing ${record.scorecard.timing}/10`);addMessage('SYNTHESIZER','Record built: customer, current alternative, wedge, and moat are now captured.');addMessage('MATCHMAKER',record.pattern);$('answerInput').disabled=true;$('answerBtn').disabled=true;$('sessionState').textContent='COMPLETE';$('currentQuestion').textContent='Interview complete.';syncProgress();setPortabilityStatus('Interview complete. Your Idea Record and results are saved in this browser.')}
function ask(){addMessage('INTERVIEWER',QUESTIONS[questionIndex]);$('sessionState').textContent=`QUESTION ${questionIndex+1}/${QUESTIONS.length}`;$('currentQuestion').textContent=QUESTIONS[questionIndex];$('answerBtn').innerHTML=questionIndex===QUESTIONS.length-1?'Finish <span aria-hidden="true">→</span>':'Next <span aria-hidden="true">→</span>';syncProgress()}
function syncProgress(){const total=QUESTIONS.length;const done=Boolean(record&&record.status==='complete');const answered=done?total:Math.min(questionIndex,total);$('progressFill').style.width=`${Math.round(answered/total*100)}%`;$('progressBar').setAttribute('aria-valuenow',String(answered));$('progressLabel').textContent=done?`Complete · ${total} of ${total} answered`:answered===total?'All answers recorded · review required':`Question ${answered+1} of ${total}`}
async function resumeInterview(r){if(!r||r.status!=='interviewing')return;record=r;questionIndex=Math.min(Array.isArray(r.answers)?r.answers.length:0,QUESTIONS.length);showInterviewMode(true,r.idea);$('transcript').textContent='';$('answerInput').disabled=false;$('answerBtn').disabled=false;for(let i=0;i<questionIndex;i++){const entry=r.answers[i];addMessage('INTERVIEWER',entry.question||QUESTIONS[i]);addMessage('FOUNDER',entry.answer)}if(questionIndex<QUESTIONS.length){ask();setPortabilityStatus('Recovered in-progress interview.')}else{$('sessionState').textContent='REVIEW REQUIRED';$('currentQuestion').textContent='All answers are recorded.';syncProgress();setPortabilityStatus('Recovered all interview answers but no completed assessment. Start a new idea or import a completed record.')}}
async function start(){
  const idea=$('ideaInput').value.trim();
  if(!idea)return;
  const prior=await load();
  if(prior&&prior.status==='interviewing'&&prior.idea===idea&&!pivotRequested){
    record=prior;
    await resumeInterview(prior);
    setPortabilityStatus('Resumed your existing interview without replacing any answers.');
    return;
  }
  if(pivotRequested&&prior&&prior.status!=='complete'){
    setPortabilityStatus('Complete your current interview before branching a pivot. Your answers are preserved.');
    return;
  }
  const pivot=Boolean(pivotRequested&&prior);
  pivotRequested=false;
  const startedAt=now();
  // New ideas get new IDs. A pivot only retains identity when explicitly chosen.
  // Previous records remain in the collection; never silently overwrite their answers.
  record={
    schemaVersion:ThinkTankContracts.SCHEMA.IDEA_RECORD,
    id:pivot?prior.id:crypto.randomUUID(),
    idea,status:'interviewing',
    createdAt:pivot?prior.createdAt:startedAt,updatedAt:startedAt,
    answers:[],modules:{},scorecard:null,critique:'',pattern:'',
    versions:pivot?[...prior.versions]:[],
    ...(pivot&&prior.workspace?{workspace:prior.workspace}:{})
  };
  showInterviewMode(true,idea);
  $('transcript').textContent='';
  questionIndex=0;
  await save();
  setPortabilityStatus(pivot?'Started an explicit pivot. Prior assessment versions and founder workspace remain saved.':'Started a separate idea. Earlier ideas remain saved in My Ideas.');
  ask();
}
async function answer(){const value=$('answerInput').value.trim();if(!value||!record)return;addMessage('FOUNDER',value);record.answers.push({question:QUESTIONS[questionIndex],answer:value,createdAt:now()});record.updatedAt=now();await save();$('answerInput').value='';questionIndex++;if(questionIndex<QUESTIONS.length)ask();else await finish()}
function showResetConfirm(){$('resetConfirm').classList.remove('hidden');$('resetCancel').focus()}function hideResetConfirm(){$('resetConfirm').classList.add('hidden')}async function confirmReset(){hideResetConfirm();await reset()}async function reset(){await ideaStore.clearCurrent();record=null;questionIndex=0;showInterviewMode(false);$('ideaInput').value='';$('answerInput').value='';$('answerInput').disabled=false;$('answerBtn').disabled=false;$('transcript').textContent='';$('sessionState').textContent='READY';$('currentQuestion').textContent='';syncProgress();setPortabilityStatus('Ready.');await renderRecord()}
function appendText(parent,tag,text,className){const node=document.createElement(tag);if(className)node.className=className;node.textContent=text;parent.appendChild(node);return node}
function renderVisualResults(r){const ready=Boolean(r && r.status==='complete' && r.scorecard);$('resultsStatus').textContent=ready?'Scored · heuristic':'Awaiting interview';$('resultsEmpty').classList.toggle('hidden',ready);$('resultsLive').classList.toggle('hidden',!ready);if(!ready)return;$('resultIdea').textContent=r.idea;$('resultScore').textContent=(r.scorecard.total??'n/a')+'/10';$('resultBottomLine').textContent='Heuristic total '+r.scorecard.total+'/10 from your four answers. Demand is unverified: treat this as a first pass, not evidence.';const s=r.scorecard;[['barMarket','valMarket',s.market],['barDifferentiation','valDifferentiation',s.differentiation],['barTiming','valTiming',s.timing]].forEach(([bar,val,n])=>{$(bar).style.width=`${Math.max(0,Math.min(10,Number(n)||0))*10}%`;$(val).textContent=`${n??'n/a'}/10`});const m=r.modules||{};$('resultCustomer').textContent=m.customer||'Not recorded';$('resultAlternative').textContent=m.alternative||'Not recorded';$('resultWedge').textContent=m.wedge||'Not recorded';$('resultMoat').textContent=m.moat||'Not recorded';$('resultCritique').textContent=r.critique||'No critique recorded.';$('resultPattern').textContent=r.pattern||'No strategic pattern recorded.'}
async function renderHub(r){
  const list=$('hubList');list.textContent='';
  let saved;
  try{saved=await ideaStore.listRecords()}
  catch(error){
    // Never erase, normalize over, or render invalid user data. Keep the
    // specific error already surfaced by load() visible for recovery.
    appendText(list,'p','Saved ideas could not be opened because local data is invalid. Nothing was changed.','muted');
    if(!$('portabilityStatus').textContent.includes('refused')){
      setPortabilityStatus('Stored Idea Record refused: '+errorMessage(error));
    }
    return;
  }
  if(!saved.length){appendText(list,'p','No ideas yet. Describe one in the Start panel.','muted');return}
  for(const itemRecord of saved){
    const item=document.createElement('article');item.className='hub-item';
    appendText(item,'div',itemRecord.idea,'hub-item-title');
    appendText(item,'div',`${itemRecord.answers?.length||0}/${QUESTIONS.length} answers · ${itemRecord.status==='complete'?'complete':'in progress'}${r?.id===itemRecord.id?' · active':''}`,'hub-item-meta');
    if(r?.id===itemRecord.id){
      const open=document.createElement('a');open.className='btn';
      open.href=itemRecord.status==='complete'?'#results':'#interview';
      open.textContent=itemRecord.status==='complete'?'View results':'Continue';
      item.appendChild(open);
    }else{
      const open=document.createElement('button');open.type='button';open.className='btn';open.textContent='Open idea';
      open.addEventListener('click',()=>void runCapability(C.IDEA_READ,async()=>{
        record=await ideaStore.selectCurrent(itemRecord.id);
        pivotRequested=false;
        await renderRecord();
        if(record.status==='interviewing'){await resumeInterview(record)}
        else{showInterviewMode(false);document.getElementById('results').scrollIntoView()}
        setPortabilityStatus('Opened existing idea without changing its contents.');
      }));
      item.appendChild(open);
    }
    list.appendChild(item);
  }
}
async function renderRecord(){const r=record||await load();renderVisualResults(r);await renderHub(r);$('buildStatus').textContent=r?(r.status==='complete'?'Saved · complete':'Saved · in progress'):'No record';$('nextTest').textContent=r&&r.status==='complete'&&r.pattern?r.pattern:'Complete the interview to get the next strategic test.';const summary=$('recordSummary');const score=$('scorecard');const versionsNode=$('versions');if(!r){summary.textContent='No active record yet.';score.textContent='Complete the interview to score the idea.';versionsNode.textContent='No versions saved.';return}summary.textContent='';appendText(summary,'strong',r.idea);summary.appendChild(document.createElement('br'));appendText(summary,'span',`${r.answers?.length||0}/${QUESTIONS.length} answers · ${r.status}`,'muted');score.textContent=r.scorecard?`Market ${r.scorecard.market}/10\nDifferentiation ${r.scorecard.differentiation}/10\nTiming ${r.scorecard.timing}/10\nOverall ${r.scorecard.total}/10`:'Awaiting completed interview.';const versions=Array.isArray(r.versions)?r.versions:[];versionsNode.textContent='';if(!versions.length){versionsNode.textContent='No versions saved.';return}[...versions].reverse().forEach(v=>appendText(versionsNode,'div',`v${v.version} · overall ${v.scorecard?.total ?? 'n/a'}/10`,'version'))}
async function exportRecord(){const current=record||await load();if(!current){setPortabilityStatus('Nothing to export yet. Complete or start an interview first.');return}const normalized=ThinkTankContracts.normalizeIdeaRecordV1(current);record=normalized;const payload={format:EXPORT_FORMAT,exportedAt:now(),record:normalized};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`think-tank-${normalized.id}.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);setPortabilityStatus('Portable Idea Record exported.')}
async function importRecordFile(file){if(!file)return;try{if(file.size>MAX_IMPORT_BYTES)throw new Error('File is too large.');const payload=JSON.parse(await file.text());if(payload?.format!==EXPORT_FORMAT)throw new Error('Unsupported export format.');const imported=ThinkTankContracts.normalizeIdeaRecordV1(payload.record);record=await ideaStore.saveCurrent(imported);await renderRecord();await resumeInterview(record);setPortabilityStatus(record.status==='interviewing'?`Imported and resumed Idea Record ${record.id}.`:`Imported Idea Record ${record.id}.`)}catch(error){setPortabilityStatus(`Import refused: ${errorMessage(error)}`)}finally{$('importInput').value=''}}
async function boot(){try{await requireCapability(C.IDEA_READ);record=await load();await renderRecord();await resumeInterview(record)}catch(error){setPortabilityStatus(`Startup refused: ${errorMessage(error)}`)}}
$('startBtn').addEventListener('click',()=>void runCapability(C.IDEA_EDIT,start));$('hubNewIdea').addEventListener('click',()=>{pivotRequested=false;$('start').scrollIntoView();$('ideaInput').focus()});$('answerBtn').addEventListener('click',()=>void runCapability(C.IDEA_EDIT,answer));$('resetBtn').addEventListener('click',()=>showResetConfirm());$('resetCancel').addEventListener('click',()=>hideResetConfirm());$('resetDelete').addEventListener('click',()=>void runCapability(C.IDEA_EDIT,confirmReset));$('exportBtn').addEventListener('click',()=>void runCapability(C.RECORD_EXPORT,exportRecord));$('importInput').addEventListener('change',event=>void runCapability(C.RECORD_IMPORT,()=>importRecordFile(event.target.files?.[0])));document.querySelectorAll('.starter-chip').forEach(chip=>chip.addEventListener('click',()=>{pivotRequested=chip.dataset.starter==="I'm considering a pivot from ";const input=$('ideaInput');input.value=chip.dataset.starter||'';input.focus();input.setSelectionRange(input.value.length,input.value.length);if(pivotRequested)setPortabilityStatus('Pivot selected: this will preserve the current idea identity and past versions when you start.')}));void boot();
function selectResultTab(id,focus){document.querySelectorAll('.result-tab').forEach(t=>{const on=t.id===`tab-${id}`;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;if(on&&focus)t.focus()});document.querySelectorAll('.result-panel').forEach(p=>p.classList.toggle('hidden',p.id!==`panel-${id}`))}
$('results').addEventListener('click',e=>{const t=e.target.closest('.result-tab');if(t)selectResultTab(t.id.slice(4),false)});
$('results').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const tabs=[...document.querySelectorAll('.result-tab')];const i=tabs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();selectResultTab(tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length].id.slice(4),true)});
selectResultTab('overview',false);
