import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readSha256(file) {
  return sha256(fs.readFileSync(file));
}

function expectedSourceSha() {
  const explicit = process.env.THINK_TANK_EXPECTED_SHA?.trim();
  if (explicit) return explicit;
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function loadRuntimeGlobals() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  for (const file of [
    'app/contracts/runtime-contracts.js',
    'app/domain/deterministic-engine.js',
    'app/policy/capability-service.js',
    'app/policy/local-capability-policy.js'
  ]) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context;
}

const manifestPath = '_site/version.json';
if (!fs.existsSync(manifestPath)) throw new Error('Missing _site/version.json. Build the static artifact first.');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const expectedSha = expectedSourceSha();
if (manifest.schemaVersion !== 'ThinkTankRuntimeManifestV1') throw new Error('Unexpected runtime manifest schema.');
if (manifest.source?.sha !== expectedSha) throw new Error(`Runtime manifest source mismatch: expected ${expectedSha}, got ${manifest.source?.sha}`);

const runtime = loadRuntimeGlobals();
if (manifest.product?.engineVersion !== runtime.ThinkTankDomain.ENGINE_VERSION) throw new Error('Runtime manifest engine version mismatch.');
if (manifest.product?.rubricVersion !== runtime.ThinkTankDomain.RUBRIC_VERSION) throw new Error('Runtime manifest rubric version mismatch.');
if (manifest.product?.ideaRecordSchema !== runtime.ThinkTankContracts.SCHEMA.IDEA_RECORD) throw new Error('Runtime manifest Idea Record schema mismatch.');

const expectedCapabilities = await new runtime.ThinkTankPolicy.LocalCapabilityPolicy().capabilitiesFor({ kind: 'local-founder' });
if (JSON.stringify(manifest.capabilities) !== JSON.stringify(expectedCapabilities)) throw new Error('Runtime manifest capability snapshot mismatch.');
if (manifest.capabilityProfile !== 'local-founder-v0') throw new Error('Runtime manifest capability profile mismatch.');

if (manifest.dependencyDeclarationSha256 !== readSha256('package.json')) throw new Error('Runtime manifest package.json hash mismatch.');
const lockfilePresent = fs.existsSync('package-lock.json');
if (manifest.dependencyLock?.present !== lockfilePresent) throw new Error('Runtime manifest lockfile presence mismatch.');
if ((manifest.dependencyLock?.sha256 ?? null) !== (lockfilePresent ? readSha256('package-lock.json') : null)) throw new Error('Runtime manifest lockfile hash mismatch.');

const actualFiles = walk('_site').map((file) => path.relative('_site', file).replaceAll('\\', '/')).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(manifest.artifactFiles)) {
  throw new Error(`Runtime manifest artifact file list mismatch: ${actualFiles.join(', ')}`);
}

const { builtAt, manifestFingerprint, ...core } = manifest;
if (typeof builtAt !== 'string' || Number.isNaN(Date.parse(builtAt))) throw new Error('Runtime manifest builtAt is invalid.');
const expectedFingerprint = `sha256:${sha256(JSON.stringify(core))}`;
if (manifestFingerprint !== expectedFingerprint) throw new Error('Runtime manifest fingerprint mismatch.');

console.log(`Runtime manifest verified: ${expectedSha} ${manifestFingerprint}`);
