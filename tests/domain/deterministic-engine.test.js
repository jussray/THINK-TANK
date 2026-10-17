const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadDomain() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  vm.runInContext(
    fs.readFileSync('app/domain/deterministic-engine.js', 'utf8'),
    context,
    { filename: 'app/domain/deterministic-engine.js' }
  );
  return context.ThinkTankDomain;
}

const fixture = JSON.parse(
  fs.readFileSync('tests/fixtures/deterministic-v0-golden.json', 'utf8')
);

test('deterministic engine version matches golden fixture contract', () => {
  const domain = loadDomain();
  assert.equal(domain.ENGINE_VERSION, fixture.engineVersion);
  assert.equal(domain.RUBRIC_VERSION, fixture.rubricVersion);
});

for (const golden of fixture.cases) {
  test(`golden parity: ${golden.name}`, () => {
    const domain = loadDomain();
    const result = domain.assessIdea(golden.record);

    // Compare the ENTIRE return, strictly. A projection of hand-picked keys let
    // the engine gain or lose top-level output invisibly: an injected
    // `nonce: Math.random()` field and a removed `engineVersion` both passed.
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), golden.expected);
  });
}

test('repeated calls produce identical output for the same record', () => {
  const domain = loadDomain();
  for (const golden of fixture.cases) {
    const first = JSON.stringify(domain.assessIdea(golden.record));
    for (let run = 0; run < 50; run += 1) {
      assert.equal(JSON.stringify(domain.assessIdea(golden.record)), first, `drift in: ${golden.name}`);
    }
  }
});

test('a fresh engine instance produces identical output to another instance', () => {
  // Catches state that leaks across loads (module-level caches, lazily seeded
  // randomness) which a single-instance repeat check would miss.
  for (const golden of fixture.cases) {
    const a = JSON.stringify(loadDomain().assessIdea(golden.record));
    const b = JSON.stringify(loadDomain().assessIdea(golden.record));
    assert.equal(a, b, `cross-instance drift in: ${golden.name}`);
  }
});

test('the golden fixture covers both sides of every engine threshold', () => {
  // Guards the fixture itself: thresholds with coverage on only one side leave
  // a corridor in which a threshold can move undetected.
  const names = fixture.cases.map((entry) => entry.name).join('\n');
  for (const required of [
    'one char below the 35',
    'exactly at the 35',
    'one char below the 45',
    'exactly at the 45',
    'no answers at all',
    'whitespace-only'
  ]) {
    assert.ok(names.includes(required), `golden fixture is missing coverage: ${required}`);
  }
});

test('an empty or whitespace-only interview never earns the favorable critique', () => {
  const domain = loadDomain();
  const favorable = 'specific enough for a first pass';

  assert.ok(!domain.critiqueIdea({ idea: 'x', answers: [] }).includes(favorable));

  const whitespace = {
    idea: 'x',
    answers: [0, 1, 2, 3].map((i) => ({ question: `Q${i}`, answer: ' '.repeat(42) }))
  };
  assert.ok(!domain.critiqueIdea(whitespace).includes(favorable));
});

test('the critic and the scorer agree about which answers are substantive', () => {
  const domain = loadDomain();
  // 42 raw characters but zero trimmed: the scorer saw 0, the critic saw 42.
  const record = {
    idea: 'x',
    answers: [0, 1, 2, 3].map((i) => ({ question: `Q${i}`, answer: ' '.repeat(42) }))
  };
  const scored = domain.scoreIdea(record);
  const padded = { idea: 'x', answers: record.answers.map((e) => ({ ...e, answer: '' })) };

  assert.deepStrictEqual(scored, domain.scoreIdea(padded), 'scorer must treat whitespace as empty');
  assert.equal(
    domain.critiqueIdea(record),
    domain.critiqueIdea(padded),
    'critic must treat whitespace as empty too'
  );
});
