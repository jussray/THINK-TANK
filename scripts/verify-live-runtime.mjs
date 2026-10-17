#!/usr/bin/env node
// Verify a LIVE deployment actually serves the artifact the manifest describes.
//
// Reading fields out of version.json only proves that a JSON file claims a SHA.
// It cannot detect tampered JS or HTML, which is the entire risk on a custom
// domain, a mirror or a CDN copy. This re-fetches every file named in
// artifactFileHashes and re-hashes the bytes.
//
// Usage: node scripts/verify-live-runtime.mjs <base-url> [expected-sha]
//        THINK_TANK_EXPECTED_SHA and THINK_TANK_EXPECTED_ENV are also honored.
import crypto from 'node:crypto';

const baseInput = process.argv[2] || process.env.THINK_TANK_LIVE_URL;
if (!baseInput) {
  console.error('Usage: node scripts/verify-live-runtime.mjs <base-url> [expected-sha]');
  process.exit(2);
}
const base = baseInput.replace(/\/+$/, '');
const expectedSha = (process.argv[3] || process.env.THINK_TANK_EXPECTED_SHA || '').trim();
const expectedEnv = (process.env.THINK_TANK_EXPECTED_ENV || '').trim();

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function fetchWithRetry(url, { attempts = 8, delayMs = 2000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (response.ok) return response;
      lastError = new Error(`${url} -> HTTP ${response.status}`);
      // A 4xx that is not 408/429 will not fix itself; fail fast.
      if (response.status < 500 && response.status !== 408 && response.status !== 429) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw lastError;
}

const manifestResponse = await fetchWithRetry(`${base}/version.json`);
const manifest = JSON.parse(await manifestResponse.text());

if (manifest.schemaVersion !== 'ThinkTankRuntimeManifestV1') {
  throw new Error(`Live runtime manifest schema mismatch: ${manifest.schemaVersion}`);
}
if (expectedSha && manifest.source?.sha !== expectedSha) {
  throw new Error(`Live runtime source mismatch: expected ${expectedSha}, got ${manifest.source?.sha}`);
}
if (expectedEnv && manifest.runtime?.environment !== expectedEnv) {
  throw new Error(`Live runtime environment mismatch: expected ${expectedEnv}, got ${manifest.runtime?.environment}`);
}

// The fingerprint must match the manifest's own fields, or the manifest was
// edited after build and every value in it is untrustworthy.
const { builtAt, manifestFingerprint, ...core } = manifest;
if (typeof manifestFingerprint !== 'string' || !manifestFingerprint.startsWith('sha256:')) {
  throw new Error('Live runtime fingerprint missing.');
}
if (manifestFingerprint !== `sha256:${sha256(JSON.stringify(core))}`) {
  throw new Error('Live runtime manifest fingerprint does not match its own fields.');
}

const hashes = manifest.artifactFileHashes;
if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes) || !Object.keys(hashes).length) {
  throw new Error('Live runtime manifest is missing artifactFileHashes. Redeploy a current artifact.');
}

const mismatches = [];
for (const [file, expectedHash] of Object.entries(hashes)) {
  const response = await fetchWithRetry(`${base}/${file}`);
  const actual = `sha256:${sha256(Buffer.from(await response.arrayBuffer()))}`;
  if (actual !== expectedHash) mismatches.push(`${file}: expected ${expectedHash}, got ${actual}`);
}
if (mismatches.length) {
  throw new Error(`Live runtime content mismatch:\n  ${mismatches.join('\n  ')}`);
}

console.log(
  `Live runtime verified at ${base}: ${manifest.source?.sha} ${manifestFingerprint} ` +
    `(${Object.keys(hashes).length} files re-hashed, env ${manifest.runtime?.environment})`
);
