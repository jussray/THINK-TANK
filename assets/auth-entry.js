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
  // Account verification and recovery stay behind the same release readiness check.
  const extra = document.createElement('section');
  extra.id = 'accountExtra';
  extra.setAttribute('aria-label', 'Email verification and password recovery');
  explore.before(extra);
  function action(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-primary btn-motion';
    button.textContent = label;
    button.addEventListener('click', async () => {
      if (submit.disabled && extra.dataset.available !== 'true') return;
      button.disabled = true;
      try { await handler(); }
      catch (error) { say(error instanceof Error ? error.message : 'Request failed'); }
      finally { button.disabled = false; }
    });
    return button;
  }
  function field(label, autocomplete, type = 'text') {
    const wrapper = document.createElement('label');
    wrapper.className = 'field';
    const caption = document.createElement('span');
    caption.className = 'lbl';
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.required = true;
    input.autocomplete = autocomplete;
    if (type === 'text') { input.inputMode = 'numeric'; input.maxLength = 6; input.pattern = '[0-9]{6}'; }
    wrapper.append(caption, input);
    return { wrapper, input };
  }
  function showVerification() {
    if (extra.dataset.available !== 'true') return;
    const code = field('Six-digit verification code', 'one-time-code');
    extra.replaceChildren(code.wrapper, action('Verify my email', async () => {
      const address = email.value.trim();
      if (!address || !/^\d{6}$/.test(code.input.value)) return say('Enter your email and six-digit code.');
      await api('/api/auth/verify-email', { email: address, otp: code.input.value });
      code.input.value = '';
      say('Email verified. You can sign in.');
      const link = document.createElement('a');
      link.href = './signin.html';
      link.textContent = 'Go to sign in';
      extra.replaceChildren(link);
    }));
  }
  function showRecovery() {
    if (extra.dataset.available !== 'true') return;
    const code = field('Six-digit password reset code', 'one-time-code');
    const replacement = field('New password (12 characters minimum)', 'new-password', 'password');
    extra.replaceChildren(
      action('Send password reset code', async () => {
        const address = email.value.trim();
        if (!address) return say('Enter your account email first.');
        const response = await api('/api/auth/password-reset/start', { email: address });
        say(response.message || 'Check your email for a reset code.');
      }),
      code.wrapper, replacement.wrapper,
      action('Set new password', async () => {
        const address = email.value.trim();
        if (!address || !/^\d{6}$/.test(code.input.value) || replacement.input.value.length < 12)
          return say('Enter your email, six-digit code and a new password of at least 12 characters.');
        await api('/api/auth/password-reset/complete', { email: address, otp: code.input.value, password: replacement.input.value });
        code.input.value = '';
        replacement.input.value = '';
        extra.replaceChildren();
        say('Password reset completed. Sign in with your new password.');
      })
    );
  }
  function enable(ready) {
    for (const input of [email, password, confirmPassword]) if (input) input.disabled = !ready;
    submit.disabled = !ready;
    extra.dataset.available = ready ? 'true' : 'false';
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
      const state = await response.json().catch(() => null);
      if (!state || state.service !== 'think-tank-auth-v1' || (response.status !== 200 && response.status !== 401)) throw Error('Unavailable');
      if (response.status === 200) {
        say('You are already signed in. Open your workspace to save ideas to your private vault.');
        submit.disabled = true;
        return;
      }
      if (signup && state.signupEnabled !== true) {
        enable(false);
        say('Account registration is not open yet. You can still explore locally.');
        return;
      }
      enable(true);
      extra.replaceChildren(action(signup ? 'I have an email verification code' : 'Forgot your password?', signup ? showVerification : showRecovery));
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
      if (signup) {
        say(data.message || 'Check your email and enter the verification code.');
        showVerification();
      }
      else window.location.assign('./workspace.html');
    } catch (error) {
      password.value = '';
      if (confirmPassword) confirmPassword.value = '';
      say(error instanceof Error ? error.message : 'Account operation failed');
    } finally { submit.disabled = false; }
  });
  void initialize();
})();