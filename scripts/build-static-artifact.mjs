import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const out = '_site';
const requiredFiles = [
  'index.html',
  'app/contracts/runtime-contracts.js',
  'app/stores/idea-store.js',
  'app/stores/local-idea-store.js',
  'app/domain/deterministic-engine.js',
  'app/policy/capability-service.js',
  'app/policy/local-capability-policy.js'
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readSha256(file) {
  return sha256(fs.readFileSync(file));
}

function resolveSourceSha() {
  const explicit = process.env.THINK_TANK_SOURCE_SHA?.trim();
  if (explicit) return explicit;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('Cannot bind runtime artifact to a source SHA. Set THINK_TANK_SOURCE_SHA when building outside a Git checkout.');
  }
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

fs.rmSync(out, { recursive: true, force: true });
for (const source of requiredFiles) {
  const destination = path.join(out, source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

const sourceSha = resolveSourceSha();
if (!/^[0-9a-f]{40}$/i.test(sourceSha)) throw new Error(`Invalid source SHA: ${sourceSha}`);

const runtime = loadRuntimeGlobals();
const capabilities = await new runtime.ThinkTankPolicy.LocalCapabilityPolicy().capabilitiesFor({ kind: 'local-founder' });
const lockfilePresent = fs.existsSync('package-lock.json');
const manifestCore = {
  schemaVersion: 'ThinkTankRuntimeManifestV1',
  source: { sha: sourceSha },
  runtime: { environment: process.env.THINK_TANK_RUNTIME_ENV?.trim() || 'local-static' },
  product: {
    engineVersion: runtime.ThinkTankDomain.ENGINE_VERSION,
    rubricVersion: runtime.ThinkTankDomain.RUBRIC_VERSION,
    ideaRecordSchema: runtime.ThinkTankContracts.SCHEMA.IDEA_RECORD
  },
  capabilityProfile: 'local-founder-v0',
  capabilities,
  dependencyDeclarationSha256: readSha256('package.json'),
  dependencyLock: {
    present: lockfilePresent,
    sha256: lockfilePresent ? readSha256('package-lock.json') : null
  },
  artifactFiles: [...requiredFiles, 'version.json'].sort()
};
const manifest = {
  ...manifestCore,
  builtAt: new Date().toISOString(),
  manifestFingerprint: `sha256:${sha256(JSON.stringify(manifestCore))}`
};
fs.writeFileSync(path.join(out, 'version.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const sensitiveNames = /(^|\/)(\.env(?:\..*)?|\.git|\.npmrc|credentials?|secrets?)(\/|$)|\.(pem|key|p12|pfx)$/i;
const sensitiveContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9_-]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\b(?:OPENAI_API_KEY|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY)\s*[:=]\s*[^\s"']+/i
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const artifactFiles = walk(out);
for (const file of artifactFiles) {
  const relative = file.replaceAll('\\', '/');
  if (sensitiveNames.test(relative)) {
    throw new Error(`Refusing sensitive artifact path: ${relative}`);
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of sensitiveContent) {
    if (pattern.test(content)) throw new Error(`Refusing possible secret in artifact: ${relative}`);
  }
}

for (const required of manifestCore.artifactFiles) {
  if (!fs.existsSync(path.join(out, required))) throw new Error(`Missing artifact file: ${required}`);
}

console.log(`Static artifact ready: ${artifactFiles.length} files, source ${sourceSha}, manifest ${manifest.manifestFingerprint}, no forbidden secret markers.`);
