// Think Tank account entry. Never sends credentials if the same-origin account API is unavailable.
(() => {
  'use strict';
  const form = document.getElementById('signin-form') || document.getElementById('create-form');
  if (!form) return;
  const signup = form.id === 'create-form';
  const email = form.querySelector('#email');
  const password = form.querySelector('#password');
  const confirmPassword = form.querySelector('#confirm');
  const submit = form.querySelector('button[type="submit"]');
  const message = document.createElement('p');
  message.id = 'accountStatus';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  message.className = 'sub';
  message.textContent = 'Checking secure accounts…';
  form.before(message);
  submit.disabled = true;
  const explore = document.createElement('a');
  explore.href = './index.html';
  explore.className = 'btn-primary btn-motion';
  explore.textContent = 'Explore locally without an account';
  explore.style.display = 'inline-block';
  explore.style.marginTop = '10px';
  form.after(explore);
  function enable(ready) {
    for (const input of [email, password, confirmPassword]) if (input) input.disabled = !ready;
    submit.disabled = !ready;
  }
  function say(text) { message.textContent = text; }
  async function api(path, body) {
    const response = await fetch(path, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Account operation was not accepted');
    return data;
  }
  async function initialize() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status !== 200 && response.status !== 401) throw Error('Unavailable');
      if (response.status === 200) {
        say('You are already signed in. Open your workspace to save ideas to your private vault.');
        submit.disabled = true;
        return;
      }
      enable(true);
      say(signup ? 'Create your private account. You will need to verify your email before signing in.' :
        'Use your verified account to access your private cloud vault.');
    } catch {
      enable(false);
      say('Secure account service is not available. You may still explore locally; do not enter a password.');
    }
  }
  form.setAttribute('method', 'post');
  form.setAttribute('action', '#');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const value = email?.value.trim() || '';
    const secret = password?.value || '';
    if (!value || secret.length < 12) return say('Enter an email and a password of at least 12 characters.');
    if (signup && secret !== (confirmPassword?.value || '')) return say('Passwords do not match.');
    if (signup && !form.querySelector('input[name="accountConsent"]')?.checked) {
      return say('Please confirm you understand private account data storage.');
    }
    submit.disabled = true;
    say('Checking your request…');
    try {
      const data = await api(signup ? '/api/auth/signup' : '/api/auth/login', { email: value, password: secret });
      password.value = '';
      if (confirmPassword) confirmPassword.value = '';
      if (signup) say(data.message || 'Check your email and verify your address, then sign in.');
      else window.location.assign('./workspace.html');
    } catch (error) {
      password.value = '';
      if (confirmPassword) confirmPassword.value = '';
      say(error instanceof Error ? error.message : 'Account operation failed');
    } finally { submit.disabled = false; }
  });
  void initialize();
})();