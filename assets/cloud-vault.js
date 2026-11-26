// Explicit opt-in cloud backup; local ideas are never uploaded automatically.
(() => {
  'use strict';
  const region = document.getElementById('cloudVault');
  if (!region || !globalThis.ThinkTankStores || !globalThis.ThinkTankContracts) return;
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const list = document.createElement('div');
  const tools = document.createElement('div');
  tools.className = 'row';
  const store = new ThinkTankStores.LocalIdeaStore();
  let aiAvailable = false;
  const aiResult = document.createElement('section');
  aiResult.className = 'card';
  aiResult.setAttribute('aria-live', 'polite');
  aiResult.hidden = true;
  region.append(aiResult);
  region.append(message, tools, list);
  const tell = text => { message.textContent = text; };
  function button(label, onClick) {
    const el = document.createElement('button');
    el.className = 'btn';
    el.textContent = label;
    el.type = 'button';
    el.addEventListener('click', () => void onClick());
    return el;
  }
  async function call(url, method = 'GET', body) {
    const options = { method, credentials: 'same-origin', cache: 'no-store' };
    if (body !== undefined) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || 'Request failed');
      error.status = res.status;
      throw error;
    }
    return data;
  }
  async function useAi(ideaId, operation) {
    const kind = operation === 'synthesize' ? 'a nine-module draft startup package' : 'one follow-up question';
    const agreed = confirm(
      'Send this saved private idea and its interview answers to Anthropic to generate ' + kind +
      '? Your idea will be shared with an external AI provider for this request. ' +
      'The response will be a draft; Think Tank will not automatically publish or overwrite any work.'
    );
    if (!agreed) return tell('AI request canceled. Nothing was sent.');
    tell('Requesting an AI draft for the selected private idea…');
    aiResult.hidden = false;
    aiResult.replaceChildren();
    const status = document.createElement('p');
    status.textContent = 'Requesting ' + kind + '…';
    aiResult.append(status);
    try {
      const data = await call('/api/ai/' + operation, 'POST', {
        ideaId, externalAIConsent: true
      });
      aiResult.replaceChildren();
      const label = document.createElement('p');
      label.textContent = 'AI-generated draft · unverified · no changes saved';
      aiResult.append(label);
      if (operation === 'interview') {
        const question = document.createElement('p');
        question.textContent = data.question;
        aiResult.append(question);
      } else if (data.status === 'pending-founder-review' && data.modules) {
        for (const [name, text] of Object.entries(data.modules)) {
          const section = document.createElement('details');
          const title = document.createElement('summary');
          title.textContent = name.replaceAll('_', ' ');
          const description = document.createElement('p');
          description.textContent = String(text);
          section.append(title, description);
          aiResult.append(section);
        }
      } else throw new Error('AI returned an invalid draft');
      tell('AI response ready for your review. Your saved record was not modified.');
    } catch (error) {
      aiResult.replaceChildren();
      const warning = document.createElement('p');
      warning.textContent = 'AI request not completed: ' + error.message;
      aiResult.append(warning);
      tell('AI request failed. Your saved ideas remain unchanged.');
    }
  }
  async function refresh() {
    const { ideas } = await call('/api/ideas');
    list.replaceChildren();
    if (!Array.isArray(ideas) || !ideas.length) return tell('Private cloud vault is empty. Save an idea explicitly to back it up.');
    tell(ideas.length + ' private cloud idea(s). They are not public or shared.');
    for (const item of ideas) {
      const itemButton = button(item.title + ' · revision ' + item.revision, async () => {
        try {
          const selected = await call('/api/ideas/' + encodeURIComponent(item.id));
          const record = ThinkTankContracts.normalizeIdeaRecordV1(selected.idea.record);
          const locals = await store.listRecords();
          if (locals.some(x => x.id === record.id) && !confirm('Replace this browser’s copy with the cloud revision? Export a local backup first.')) {
            return tell('Import canceled. No local record was changed.');
          }
          await store.saveCurrent(record);
          location.reload();
        } catch (error) { tell('Cloud import refused: ' + error.message); }
      });
      if (aiAvailable) {
        const row = document.createElement('div');
        row.className = 'row';
        row.append(
          itemButton,
          button('Ask AI a question', () => useAi(item.id, 'interview')),
          button('Draft startup package', () => useAi(item.id, 'synthesize'))
        );
        list.append(row);
      } else {
        list.append(itemButton);
      }
    }
  }
  async function saveCurrent() {
    try {
      const current = await store.loadCurrent();
      if (!current) return tell('Create or import an idea in the local workspace first.');
      const record = ThinkTankContracts.normalizeIdeaRecordV1(current);
      const remote = await call('/api/ideas');
      const match = remote.ideas.find(x => x.id === record.id);
      if (match) {
        if (!confirm('Replace your cloud revision ' + match.revision + ' with this browser copy? Export a backup first.')) {
          return tell('Cloud overwrite canceled.');
        }
        await call('/api/ideas/' + record.id, 'PUT', { record, expectedRevision: match.revision });
      } else await call('/api/ideas', 'POST', { record });
      tell('Saved to your private cloud vault. Your local copy was preserved.');
      await refresh();
    } catch (error) { tell('Cloud save refused: ' + error.message); }
  }
  async function signOut() {
    if (!confirm('Sign out? Your browser still holds local ideas. Export a copy and clear browser data before sharing this device.')) return;
    try {
      await call('/api/auth/logout', 'POST', {});
      tools.replaceChildren();
      list.replaceChildren();
      const link = document.createElement('a');
      link.href = './signin.html';
      link.textContent = 'Sign in again';
      tools.append(link);
      tell('Signed out of the cloud vault. Local browser ideas were not deleted.');
    } catch (error) { tell('Sign-out failed: ' + error.message); }
  }
  async function boot() {
    try {
      const { user, service } = await call('/api/auth/me');
      if (service !== 'think-tank-auth-v1' || !user?.userId) throw new Error('Invalid account service');
      const email = typeof user?.email === 'string' ? user.email : 'your account';
      tell('Signed in as ' + email + '. Nothing is uploaded automatically.');
      tools.append(button('Save current idea to private vault', saveCurrent), button('Refresh vault', refresh), button('Sign out of cloud', signOut));
      // Only render AI actions when the authenticated backend explicitly
      // reports an enabled, rate-limited provider. No data leaves on page load.
      const capability = await call('/api/ai/status').catch(() => ({ enabled: false }));
      aiAvailable = capability.enabled === true && capability.requiresExplicitConsent === true;
      await refresh();
    } catch (error) {
      if (error.status === 401) {
        const link = document.createElement('a');
        link.href = './signin.html';
        link.textContent = 'Sign in to use a private cloud vault';
        tools.append(link);
        tell('Your ideas are currently only stored in this browser.');
      } else tell('Cloud vault is unavailable. Local ideas and exports still work.');
    }
  }
  void boot();
})();