// `npm run build` is what Cloudflare Workers Builds invokes, and it now chains
// build:static into check:runtime-manifest. Both halves must resolve the source
// SHA from WORKERS_CI_COMMIT_SHA, because a Workers Builds image may not provide
// a usable git dir. Without that, adding the check to the build would BREAK the
// deploy rather than guard it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = process.cwd();
const CI_SHA = 'c'.repeat(40);

// A copy with NO .git, mimicking a build image that exports the commit but
// provides no git metadata.
function gitlessCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-ci-'));
  fs.cpSync(repoRoot, dir, {
    recursive: true,
    filter: (src) =>
      !src.includes(`${path.sep}node_modules`) &&
      !src.includes(`${path.sep}_site`) &&
      !src.includes(`${path.sep}.git`)
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

test('the build script binds the artifact to WORKERS_CI_COMMIT_SHA when git is absent', () => {
  const dir = gitlessCopy();
  try {
    assert.equal(fs.existsSync(path.join(dir, '.git')), false, 'fixture must have no git dir');

    const built = run(dir, 'build-static-artifact.mjs', { WORKERS_CI_COMMIT_SHA: CI_SHA });
    assert.equal(built.status, 0, `build failed: ${built.stderr}`);

    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '_site/version.json'), 'utf8'));
    assert.equal(manifest.source.sha, CI_SHA);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the manifest checker accepts WORKERS_CI_COMMIT_SHA when git is absent', () => {
  const dir = gitlessCopy();
  try {
    const env = { WORKERS_CI_COMMIT_SHA: CI_SHA };
    assert.equal(run(dir, 'build-static-artifact.mjs', env).status, 0);

    const checked = run(dir, 'check-runtime-manifest.mjs', env);
    assert.equal(checked.status, 0, `checker failed: ${checked.stderr}`);
    assert.match(checked.stdout, new RegExp(CI_SHA));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an explicit expected SHA still overrides the CI fallback', () => {
  const dir = gitlessCopy();
  try {
    assert.equal(run(dir, 'build-static-artifact.mjs', { WORKERS_CI_COMMIT_SHA: CI_SHA }).status, 0);

    // The artifact says CI_SHA; asserting a different expectation must fail.
    const checked = run(dir, 'check-runtime-manifest.mjs', {
      WORKERS_CI_COMMIT_SHA: CI_SHA,
      THINK_TANK_EXPECTED_SHA: 'e'.repeat(40)
    });
    assert.notEqual(checked.status, 0, 'an explicit expectation must take precedence and fail on mismatch');
    assert.match(checked.stderr, /source mismatch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('with no SHA source at all, both scripts fail with a clear message instead of a raw git error', () => {
  const dir = gitlessCopy();
  try {
    const blank = { WORKERS_CI_COMMIT_SHA: '', THINK_TANK_SOURCE_SHA: '', THINK_TANK_EXPECTED_SHA: '' };

    const built = run(dir, 'build-static-artifact.mjs', blank);
    assert.notEqual(built.status, 0);
    assert.match(built.stderr, /Cannot bind runtime artifact to a source SHA/);

    // Build one valid artifact so the checker fails on SHA resolution, not on a
    // missing _site.
    assert.equal(run(dir, 'build-static-artifact.mjs', { WORKERS_CI_COMMIT_SHA: CI_SHA }).status, 0);
    const checked = run(dir, 'check-runtime-manifest.mjs', blank);
    assert.notEqual(checked.status, 0);
    assert.match(checked.stderr, /Cannot determine the expected source SHA/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a Cloudflare build labels its own runtime environment', () => {
  const dir = gitlessCopy();
  try {
    // Workers Builds exports WORKERS_CI_COMMIT_SHA; the artifact must label
    // itself cloudflare-workers so the live check can require it.
    assert.equal(run(dir, 'build-static-artifact.mjs', { WORKERS_CI_COMMIT_SHA: CI_SHA }).status, 0);
    let manifest = JSON.parse(fs.readFileSync(path.join(dir, '_site/version.json'), 'utf8'));
    assert.equal(manifest.runtime.environment, 'cloudflare-workers');

    // An explicit label still wins, and a local build is still local-static.
    assert.equal(
      run(dir, 'build-static-artifact.mjs', { WORKERS_CI_COMMIT_SHA: CI_SHA, THINK_TANK_RUNTIME_ENV: 'staging' }).status,
      0
    );
    manifest = JSON.parse(fs.readFileSync(path.join(dir, '_site/version.json'), 'utf8'));
    assert.equal(manifest.runtime.environment, 'staging');

    assert.equal(run(dir, 'build-static-artifact.mjs', { THINK_TANK_SOURCE_SHA: CI_SHA }).status, 0);
    manifest = JSON.parse(fs.readFileSync(path.join(dir, '_site/version.json'), 'utf8'));
    assert.equal(manifest.runtime.environment, 'local-static');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
