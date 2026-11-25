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
      list.append(itemButton);
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