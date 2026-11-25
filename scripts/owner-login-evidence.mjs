// Pure, privacy-preserving evaluation of Cloudflare Access authentication logs.
// A passing result proves an observed Access login decision, not that the
// protected application rendered a functional authenticated session.
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function evaluateOwnerLoginEvidence({ events, originAppId, ownerEmails, nowMs = Date.now(), maxAgeMs = 86400000 }) {
  if (!Array.isArray(events) || !originAppId || !Number.isFinite(nowMs) ||
      !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 60000 || maxAgeMs > 86400000) {
    throw new Error('Access login evidence is invalid');
  }
  if (!Array.isArray(ownerEmails) || ownerEmails.length < 1 || ownerEmails.length > 5 ||
      !ownerEmails.every(e => typeof e === 'string' && emailPattern.test(e))) {
    throw new Error('Invalid owner allowlist');
  }
  const owners = new Set(ownerEmails.map(x => x.toLowerCase()));
  if (owners.size !== ownerEmails.length) throw new Error('Invalid owner allowlist duplicates');

  let ownerLoginEvents = 0;
  for (const ev of events) {
    if (!ev || typeof ev !== 'object' || ev.app_uid !== originAppId || ev.action !== 'login') continue;
    if (typeof ev.allowed !== 'boolean') throw new Error('Unverifiable Access event result');
    if (!ev.allowed) continue;
    if (typeof ev.user_email !== 'string' || !emailPattern.test(ev.user_email)) {
      throw new Error('Unverifiable approved Access identity');
    }
    const when = Date.parse(ev.created_at);
    if (!Number.isFinite(when)) throw new Error('Invalid approved Access timestamp');
    if (when < nowMs - maxAgeMs || when > nowMs + 5 * 60000) continue;
    if (!owners.has(ev.user_email.toLowerCase())) {
      throw new Error('Approved non-owner Access login detected');
    }
    ownerLoginEvents += 1;
  }

  if (!ownerLoginEvents) throw new Error('No recent approved owner login observed');
  return { status: 'observed-access-login', ownerLoginEvents };
}
