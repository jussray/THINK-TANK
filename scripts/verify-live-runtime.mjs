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
import fs from 'node:fs';

const baseInput = process.argv[2] || process.env.THINK_TANK_LIVE_URL;
if (!baseInput) {
  console.error('Usage: node scripts/verify-live-runtime.mjs <base-url> [expected-sha]');
  process.exit(2);
}
const base = baseInput.replace(/\/+$/, '');
const expectedSha = (process.argv[3] || process.env.THINK_TANK_EXPECTED_SHA || '').trim();
const expectedEnv = (process.env.THINK_TANK_EXPECTED_ENV || '').trim();
const trustedManifestPath = (process.env.THINK_TANK_TRUSTED_MANIFEST_FILE || '').trim();
if (!/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('Exact expected source SHA is required');
if (!trustedManifestPath) throw new Error('Trusted locally rebuilt artifact manifest is required');
const trusted = JSON.parse(fs.readFileSync(trustedManifestPath, 'utf8'));
if (trusted.source?.sha !== expectedSha) throw new Error('Trusted artifact source SHA mismatch');
if (expectedEnv && trusted.runtime?.environment !== expectedEnv) throw new Error('Trusted artifact environment mismatch');
if (expectedEnv === 'cloudflare-workers' && new URL(base).origin !== 'https://www.thinktank.jussco.company') {
  throw new Error('Production proof must target the canonical Cloudflare hostname');
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function fetchWithRetry(url, { attempts = 8, delayMs = 2000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
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

// Compare against bytes rebuilt from the APPROVED exact GitHub source, not merely
// a self-consistent remotely supplied manifest. A forged file + forged hash +
// recomputed fingerprint otherwise passes the old verifier.
const hashes = manifest.artifactFileHashes;
if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes) || !Object.keys(hashes).length) {
  throw new Error('Live runtime manifest is missing artifactFileHashes. Redeploy a current artifact.');
}

const sourceHashes = trusted.artifactFileHashes;
if (!sourceHashes || typeof sourceHashes !== 'object' || Array.isArray(sourceHashes) || !Object.keys(sourceHashes).length) {
  throw new Error('Trusted local artifact lacks content hashes');
}
const actualKeys = Object.keys(hashes).sort();
const trustedKeys = Object.keys(sourceHashes).sort();
if (JSON.stringify(actualKeys) !== JSON.stringify(trustedKeys)) {
  throw new Error('Live artifact coverage differs from trusted GitHub source');
}
if (JSON.stringify(manifest.artifactFiles) !== JSON.stringify(trusted.artifactFiles) ||
    JSON.stringify(manifest.product) !== JSON.stringify(trusted.product) ||
    JSON.stringify(manifest.capabilities) !== JSON.stringify(trusted.capabilities) ||
    manifest.capabilityProfile !== trusted.capabilityProfile) {
  throw new Error('Live product or capability contract differs from trusted GitHub source');
}
for (const file of trustedKeys) {
  if (hashes[file] !== sourceHashes[file]) throw new Error('Live artifact hash differs from trusted GitHub source: ' + file);
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
  `Live runtime content VERIFIED against trusted GitHub source at ${base}: ${manifest.source?.sha} ${manifestFingerprint} ` +
    `(${Object.keys(hashes).length} files re-hashed, env ${manifest.runtime?.environment})`
);
