import fs from 'node:fs';
import path from 'node:path';

const out = '_site';
const requiredFiles = [
  'index.html',
  'app/stores/idea-store.js',
  'app/stores/local-idea-store.js',
  'app/stores/memory-idea-store.js',
  'app/domain/deterministic-engine.js'
];

fs.rmSync(out, { recursive: true, force: true });
for (const source of requiredFiles) {
  const destination = path.join(out, source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

const sensitiveNames = /(^|\/)(\.env(?:\..*)?|\.git)(\/|$)|\.(pem|key|p12|pfx)$/i;
const sensitiveContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|ghp)_[A-Za-z0-9_-]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\b(?:OPENAI_API_KEY|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*[^\s"']+/i
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

for (const required of requiredFiles) {
  if (!fs.existsSync(path.join(out, required))) throw new Error(`Missing artifact file: ${required}`);
}

console.log(`Static artifact ready: ${artifactFiles.length} files, no forbidden secret markers.`);
