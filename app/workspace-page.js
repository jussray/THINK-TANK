'use strict';
const store = new ThinkTankStores.LocalIdeaStore();
const moduleNames = ThinkTankContracts.WORKSPACE_MODULES;
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const $ = id => document.getElementById(id);
let record = null, records = [], screen = 'workspace';
function node(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = String(text);
  if (className) n.className = className;
  return n;
}
function button(text, action, kind) {
  const b = node('button', text, 'btn' + (kind ? ' ' + kind : ''));
  b.type = 'button';
  b.addEventListener('click', () => void safe(action));
  return b;
}
function safe(action) {
  return Promise.resolve().then(action).catch(error => tell('Action refused: ' + (error instanceof Error ? error.message : 'Unknown error')));
}
function tell(message) { $('status').textContent = message; }
function sectionCard(label, title) {
  const card = node('article', null, 'card');
  card.append(node('div', label, 'label'), node('h3', title));
  return card;
}
function sourceRevision() {
  // Bump on every workspace change, including same-millisecond edits.
  const previous = record && record.updatedAt ? Date.parse(record.updatedAt) : 0;
  return new Date(Math.max(Date.now(), previous + 1)).toISOString();
}
function workspace() {
  if (!record.workspace) {
    record.workspace = { schemaVersion: ThinkTankContracts.WORKSPACE_SCHEMA, modules: {}, proposals: [], history: [] };
  }
  return record.workspace;
}
function event(kind, module, before, after, proposalId) {
  const history = workspace().history;
  if (history.length >= 300) throw new Error('History limit reached. Export your Idea Record before continuing.');
  history.push({ id: uid(), at: now(), kind, module: module || '', proposalId: proposalId || '', before: before || '', after: after || '' });
}
async function persist() {
  const normalized = await store.saveCurrent(record);
  record = normalized;
  records = await store.listRecords();
}
async function boot() {
  record = await store.loadCurrent();
  records = await store.listRecords();
  render();
}
async function activate(id) {
  record = await store.selectCurrent(id);
  records = await store.listRecords();
  render();
  tell('Selected existing Idea Record.');
}
async function createIdea() {
  const title = prompt('What idea are you building?');
  if (title === null) return;
  const idea = title.trim();
  if (!idea || idea.length > 4000) return tell('Enter an idea of 1–4000 characters.');
  const at = now();
  record = {
    schemaVersion: ThinkTankContracts.SCHEMA.IDEA_RECORD,
    id: uid(), idea, status: 'interviewing', createdAt: at, updatedAt: at,
    answers: [], modules: {}, scorecard: null, critique: '', pattern: '', versions: []
  };
  await persist();
  screen = 'workspace';
  render();
  tell('New canonical Idea Record created. Open Interview to answer the four questions.');
}
function renderIdeas() {
  const list = $('ideaList');
  list.replaceChildren();
  for (const idea of records) {
    const b = node('button', idea.idea, 'idea-item' + (record && idea.id === record.id ? ' selected' : ''));
    b.type = 'button';
    b.dataset.recordId = idea.id;
    b.addEventListener('click', () => void safe(() => activate(idea.id)));
    list.append(b);
  }
}
function render() {
  renderIdeas();
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === screen));
  $('title').textContent = record ? record.idea : 'Build your first Idea Record';
  $('subtitle').textContent = ({
    workspace: 'Edit founder-owned modules. Existing interview analysis remains separate.',
    proposals: 'Review local suggestions. Nothing becomes canonical until you accept it.',
    history: 'Inspect assessment versions and local action receipts. Browser history is not tamper-proof.'
  })[screen];
  const root = $('view');
  root.replaceChildren();
  if (!record) {
    const card = node('div', null, 'card empty');
    card.append(node('h2', 'No active idea'), node('p', 'Create an idea or return to Interview.', 'muted'), button('Create idea', createIdea, 'primary'));
    root.append(card);
    return;
  }
  if (screen === 'workspace') renderWorkspace(root);
  else if (screen === 'proposals') renderProposals(root);
  else renderHistory(root);
}
function renderWorkspace(root) {
  const tip = node('p', 'Ten editable founder modules. Generated interview fields remain untouched. Proposals are separate until accepted.', 'muted small');
  root.append(tip);
  const grid = node('div', null, 'grid');
  const state = workspace();
  for (const name of moduleNames) {
    const saved = state.modules[name];
    const card = sectionCard(name.toUpperCase(), saved ? 'Founder workspace · saved' : 'Founder workspace · empty');
    const label = node('label', 'Module content');
    const area = node('textarea');
    area.value = saved ? saved.content : '';
    area.maxLength = 8000;
    area.setAttribute('aria-label', name + ' content');
    area.dataset.module = name;
    label.append(area);
    const footer = node('div', null, 'row');
    const save = button('Save ' + name, async () => {
      const content = area.value;
      const w = workspace();
      const previous = w.modules[name] ? w.modules[name].content : '';
      if (w.history.length >= 300) throw new Error('History is full. Export before continuing.');
      const timestamp = sourceRevision();
      w.modules[name] = { content, origin: 'founder', updatedAt: timestamp };
      event('module.saved', name, previous, content);
      record.updatedAt = timestamp;
      await persist();
      render();
      tell(name + ' saved in the canonical Idea Record.');
    });
    save.dataset.testid = 'save-module-' + moduleNames.indexOf(name);
    footer.append(save);
    if (saved) footer.append(node('span', saved.origin + ' · ' + saved.updatedAt, 'muted small'));
    card.append(label, footer);
    grid.append(card);
  }
  root.append(grid);
}
function proposalFromInterview() {
  const result = {};
  const answers = record.answers.map(entry => entry.answer);
  result.Summary = record.idea;
  if (answers[0]) result.Customer = 'Founder-reported customer:\n' + answers[0];
  if (answers[1]) result.Problem = 'Founder-reported existing alternative (not independently verified):\n' + answers[1];
  if (answers[2]) result.Solution = 'Founder-reported switching trigger:\n' + answers[2];
  if (record.status === 'complete') {
    result['Action plan'] = 'Local heuristic only. Test this with real customers:\n' + record.critique + '\n' + record.pattern;
    result.Scorecard = 'Founder-input heuristic, NOT validated demand:\nMarket ' + record.scorecard.market + '/10\nDifferentiation ' + record.scorecard.differentiation + '/10\nTiming ' + record.scorecard.timing + '/10\nOverall ' + record.scorecard.total + '/10';
  } else {
    result.Scorecard = 'Interview incomplete: ' + answers.length + '/4 answers. No evaluation has run.';
  }
  return result;
}
async function generateProposal() {
  if (!record.answers.length) return tell('Answer at least one interview question first.');
  const w = workspace();
  if (w.proposals.some(p => p.status === 'pending')) {
    screen = 'proposals'; render(); return tell('Resolve the existing pending proposal first.');
  }
  if (w.proposals.length >= 30 || w.history.length >= 300) throw new Error('Proposal/history limit reached. Export your record before continuing.');
  const timestamp = sourceRevision();
  const proposal = {
    id: uid(), createdAt: timestamp, baseRevision: timestamp,
    status: 'pending', answerCount: record.answers.length, modules: proposalFromInterview()
  };
  w.proposals.push(proposal);
  event('proposal.generated', '', '', '', proposal.id);
  record.updatedAt = timestamp;
  await persist();
  screen = 'proposals'; render();
  tell('Local proposal ready for founder review. Modules remain unchanged.');
}
async function acceptProposal(id) {
  const w = workspace();
  const p = w.proposals.find(item => item.id === id);
  if (!p || p.status !== 'pending') return;
  if (p.baseRevision !== record.updatedAt) return tell('Proposal is stale because this Idea Record changed. Reject it and generate a new proposal.');
  const keys = Object.keys(p.modules);
  const occupied = keys.filter(key => w.modules[key] && w.modules[key].content);
  const warning = 'Accept ' + keys.join(', ') + '?' +
    (occupied.length ? '\nFounder content will be REPLACED in: ' + occupied.join(', ') + '. Previous values remain in local history.' : '') +
    '\nOnly this local idea record changes. Continue?';
  if (!confirm(warning)) return;
  if (w.history.length + keys.length + 1 > 300) return tell('History limit reached. Export before continuing.');
  const timestamp = sourceRevision();
  for (const name of keys) {
    const before = w.modules[name] ? w.modules[name].content : '';
    w.modules[name] = { content: p.modules[name], origin: 'accepted-local-proposal', updatedAt: timestamp };
    event('module.saved', name, before, p.modules[name], p.id);
  }
  p.status = 'accepted';
  event('proposal.accepted', '', '', '', p.id);
  record.updatedAt = timestamp;
  await persist();
  screen = 'workspace'; render();
  tell('Accepted by founder. Every replacement has a local before/after receipt.');
}
async function rejectProposal(id) {
  const w = workspace();
  const p = w.proposals.find(item => item.id === id);
  if (!p || p.status !== 'pending') return;
  event('proposal.rejected', '', '', '', p.id);
  p.status = 'rejected';
  record.updatedAt = sourceRevision();
  await persist();
  render(); tell('Proposal rejected. Founder modules remain unchanged.');
}
function renderProposals(root) {
  const actions = node('div', null, 'row');
  actions.append(button('Generate local proposal', generateProposal, 'primary'));
  root.append(actions, node('p', 'Proposals map the four original interview answers to workspace modules. They do not invoke AI or external research.', 'muted small'));
  const stack = node('div', null, 'stack');
  const proposals = [...workspace().proposals].reverse();
  if (!proposals.length) stack.append(node('p', 'No proposals yet. Complete an interview to prepare your first local proposal.', 'muted'));
  for (const proposal of proposals) {
    const card = sectionCard('LOCAL SYNTHESIS · ' + proposal.status.toUpperCase(), proposal.answerCount + '/4 interview answers');
    card.append(node('p', proposal.createdAt + ' · no provider call', 'muted small'));
    for (const [name, content] of Object.entries(proposal.modules)) {
      const details = node('details');
      details.append(node('summary', name), node('p', content, 'content'));
      card.append(details);
    }
    if (proposal.status === 'pending') {
      const buttons = node('div', null, 'row');
      const accept = button('Review & accept', () => acceptProposal(proposal.id), 'primary');
      accept.dataset.testid = 'accept-proposal';
      const reject = button('Reject', () => rejectProposal(proposal.id));
      reject.dataset.testid = 'reject-proposal';
      buttons.append(accept, reject);
      card.append(buttons);
    }
    stack.append(card);
  }
  root.append(stack);
}
function renderHistory(root) {
  const w = workspace();
  const card = sectionCard('RECEIPTS · BROWSER-LOCAL', 'Assessment versions and founder actions');
  card.append(node('p', 'This is a local continuity trail, not cryptographic provenance, server attestation or proof of market outcomes.', 'muted small'));
  const versions = [...record.versions].reverse();
  for (const version of versions) {
    const item = node('div', null, 'receipt');
    item.append(node('div', 'ASSESSMENT v' + version.version, 'label'),
      node('p', version.createdAt + ' · heuristic ' + version.scorecard.total + '/10', 'muted small'),
      node('p', version.idea, 'content'));
    card.append(item);
  }
  for (const eventItem of [...w.history].reverse()) {
    const item = node('div', null, 'receipt');
    item.append(node('div', eventItem.kind, 'label'), node('p', eventItem.at + (eventItem.module ? ' · ' + eventItem.module : ''), 'muted small'));
    const details = node('details');
    details.append(node('summary', 'Inspect before/after'));
    details.append(node('p', 'Before:\n' + (eventItem.before || '(empty)') + '\n\nAfter:\n' + (eventItem.after || '(empty)') +
      (eventItem.proposalId ? '\n\nProposal ID: ' + eventItem.proposalId : ''), 'content small'));
    item.append(details);
    card.append(item);
  }
  root.append(card);
}
function download(filename, payload, mime) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: mime || 'application/json' }));
  const a = node('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportSelected() {
  if (!record) return tell('No active Idea Record.');
  download('think-tank-' + record.id + '.json', {
    format: 'think-tank-export-v1', exportedAt: now(), record: ThinkTankContracts.normalizeIdeaRecordV1(record)
  });
  tell('Portable Idea Record exported with its workspace and receipts.');
}
async function exportAll() {
  const all = await store.listRecords();
  if (!all.length) return tell('No ideas to back up.');
  download('think-tank-workspace-backup.json', {
    format: 'think-tank-workspace-v1', exportedAt: now(), activeId: record ? record.id : null, records: all
  });
  tell('All ' + all.length + ' Idea Records exported, including workspaces and receipts.');
}
async function importAll(file) {
  if (!file) return;
  if (file.size > 4_000_000) throw new Error('Backup is larger than 4 MB.');
  let payload;
  try { payload = JSON.parse(await file.text()); }
  catch { throw new Error('Invalid JSON.'); }
  if (payload.format !== 'think-tank-workspace-v1' || !Array.isArray(payload.records) ||
      payload.records.length < 1 || payload.records.length > 100) throw new Error('Unsupported workspace backup.');
  const incoming = payload.records.map(item => ThinkTankContracts.normalizeIdeaRecordV1(item));
  if (new Set(incoming.map(item => item.id)).size !== incoming.length) throw new Error('Backup contains duplicate ids.');
  const prior = await store.listRecords();
  const collisions = incoming.filter(item => prior.some(existing => existing.id === item.id));
  if (prior.length + incoming.length - collisions.length > 100) throw new Error('Import would exceed 100 ideas.');
  if (!confirm('Import ' + incoming.length + ' validated Idea Records?' +
       (collisions.length ? '\n' + collisions.length + ' existing record(s) with matching IDs will be REPLACED. Export a backup first.' : '') +
       '\nExisting nonmatching ideas will be preserved. Continue?')) return;
  // All records are validated and conflicts disclosed before any writes.
  // Browser storage does not provide a multi-write transaction. If it fills up,
  // the UI reports the failure; a full backup should be kept externally.
  for (const item of incoming) await store.saveCurrent(item);
  const selected = payload.activeId && incoming.find(item => item.id === payload.activeId);
  record = await store.selectCurrent(selected ? selected.id : incoming[0].id);
  records = await store.listRecords();
  render(); tell('Imported ' + incoming.length + ' records. Existing unrelated ideas preserved.');
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  screen = b.dataset.view; render(); tell('');
}));
$('newIdea').addEventListener('click', () => void safe(createIdea));
$('exportSelected').addEventListener('click', () => void safe(exportSelected));
$('exportAll').addEventListener('click', () => void safe(exportAll));
$('importAll').addEventListener('change', event => {
  const file = event.target.files && event.target.files[0];
  void safe(() => importAll(file));
  event.target.value = '';
});
void safe(boot);
