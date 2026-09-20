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
    const comparable = {
      scorecard: JSON.parse(JSON.stringify(result.scorecard)),
      critique: result.critique,
      modules: JSON.parse(JSON.stringify(result.modules)),
      pattern: result.pattern
    };

    assert.deepEqual(comparable, golden.expected);
  });
}
