import crypto from 'node:crypto';

// Cloudflare Web Analytics may inject exactly one recognized script immediately
// before </body>. Never normalize other scripts, CSS, JSON, or changed HTML.
// This is source-byte attestation AFTER a declared edge transformation, not a
// claim that public HTTP bytes equal the built artifact.
const beaconPattern = /\n<script type="module" src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\/v[a-f0-9]{32,64}" integrity="sha512-[A-Za-z0-9+/]{86}==" data-cf-beacon='([^']{1,512})' crossorigin="anonymous"><\/script>(?=\r?\n<\/body>)/g;
const sha256 = value => 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
const failure = { match: false, transform: 'unexplained' };

export function verifyServedFile(file, bytes, expectedHash) {
  const data = Buffer.from(bytes);
  if (sha256(data) === expectedHash) return { match: true, transform: 'none' };
  if (!file.endsWith('.html')) return { ...failure };

  const html = data.toString('utf8');
  if (!Buffer.from(html, 'utf8').equals(data)) return { ...failure };
  const matches = [...html.matchAll(beaconPattern)];
  if (matches.length !== 1) return { ...failure };
  const [snippet, metadata] = matches[0];
  let info;
  try { info = JSON.parse(metadata); } catch { return { ...failure }; }
  if (!info || typeof info !== 'object' || Array.isArray(info) ||
      !Object.keys(info).every(key => ['version', 'token', 'r', 'spa'].includes(key)) ||
      !/^20\d{2}\.\d{1,2}\.\d{1,2}$/.test(info.version) ||
      !/^[a-f0-9]{32}$/.test(info.token) ||
      info.r !== 1 || info.spa !== 2) return { ...failure };

  const clean = Buffer.from(html.replace(snippet, ''), 'utf8');
  return sha256(clean) === expectedHash
    ? { match: true, transform: 'cloudflare-web-analytics-beacon' }
    : { ...failure };
}
