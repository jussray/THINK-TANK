// The public front-door is the production proof target; the protected origin
// remains an optional authorized diagnostic target. Never attest an arbitrary
// host using a trusted GitHub build's source SHA.
const approvedCloudflareOrigins = new Set([
  'https://thinktank.jussco.company',
  'https://thinktank-app.jussco.company'
]);

export function assertProductionLiveOrigin(baseInput, environment) {
  if (environment !== 'cloudflare-workers') return;
  let url;
  try {
    url = new URL(baseInput);
  } catch {
    throw new Error('Production proof requires a valid absolute URL');
  }
  if (
    url.protocol !== 'https:' ||
    !approvedCloudflareOrigins.has(url.origin) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error('Production proof must use an approved Think Tank HTTPS hostname at its root');
  }
}
