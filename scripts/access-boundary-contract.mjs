// Read-only contract for the Cloudflare configuration observed on 2026-11-24.
// Do not accept a green result as proof of a browser-authenticated user journey.
const exactName = (item, expected, label) => {
  if (item?.name !== expected) throw new Error(label + ' name does not match the authorized boundary');
};

const checkedWorker = (app, label) => {
  if (app?.type !== 'self_hosted' || app?.destinations?.length !== 1 ||
      app.destinations[0]?.type !== 'worker' || !app.destinations[0]?.worker_id) {
    throw new Error(label + ' must protect exactly one Worker destination');
  }
  return app.destinations[0].worker_id;
};

const ownerEmails = (include, label) => {
  if (!Array.isArray(include) || include.length < 1 || include.length > 5) {
    throw new Error(label + ' must list a bounded set of owner email identities');
  }
  const values = include.map(entry => {
    if (!entry || Object.keys(entry).length !== 1 ||
        typeof entry.email?.email !== 'string' ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry.email.email)) {
      throw new Error(label + ' must contain only explicit email selectors');
    }
    return entry.email.email.toLowerCase();
  }).sort();
  if (new Set(values).size !== values.length) throw new Error(label + ' has duplicate email selectors');
  return values;
};

export function assertAccessBoundary({ publicApp, originApp, ownerPolicy, frontSettings }) {
  exactName(publicApp, 'think-tank-public-front-door - Public Only', 'public Worker');
  exactName(originApp, 'think-tank - Cloudflare Workers', 'origin Worker');
  exactName(ownerPolicy, 'Allow founder owner mailboxes', 'owner policy');
  const publicId = checkedWorker(publicApp, 'public Worker');
  const originId = checkedWorker(originApp, 'origin Worker');
  if (publicId === originId) throw new Error('public and origin Workers must have distinct destinations');

  if (publicApp.policies?.length !== 1) throw new Error('public Worker must have one bypass policy');
  const publiclyAccessible = publicApp.policies[0];
  if (publiclyAccessible.name !== 'Public homepage Worker bypass' ||
      publiclyAccessible.decision !== 'bypass' || publiclyAccessible.reusable === true ||
      publiclyAccessible.include?.length !== 1 ||
      !Object.hasOwn(publiclyAccessible.include[0], 'everyone') ||
      Object.keys(publiclyAccessible.include[0]).length !== 1 ||
      publiclyAccessible.exclude?.length || publiclyAccessible.require?.length) {
    throw new Error('public Worker must preserve its intentional Everyone bypass');
  }

  if (originApp.policies?.length !== 1) throw new Error('origin Worker must have one owner-only policy');
  const restricted = originApp.policies[0];
  if (restricted.name !== 'Think Tank origin - owner mailboxes' ||
      restricted.decision !== 'allow' || restricted.reusable !== false ||
      restricted.exclude?.length || restricted.require?.length) {
    throw new Error('origin Worker must use its app-specific owner-only Allow policy');
  }
  if (ownerPolicy.decision !== 'allow') throw new Error('owner reference policy must remain Allow');
  const expected = ownerEmails(ownerPolicy.include, 'owner reference');
  const actual = ownerEmails(restricted.include, 'origin owner policy');
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error('origin owner emails differ from the founder owner allowlist');
  }

  const binding = frontSettings?.bindings?.filter(x =>
    x.type === 'service' && x.name === 'APP' && x.service === 'think-tank' &&
    x.environment === 'production'
  );
  if (!binding || binding.length !== 1) {
    throw new Error('public Worker APP service binding to the protected origin is missing');
  }
  return { publicBypass: true, originOwnerOnly: true, ownerIdentityCount: actual.length, serviceBinding: true };
}
