const test = require('node:test');
const assert = require('node:assert/strict');
const { SSEParser } = require('../../repair-candidate/stream/sse-parser.ts');

const encoder = new TextEncoder();

function framesFromChunks(chunks) {
  const parser = new SSEParser();
  const frames = chunks.flatMap(chunk => parser.push(encoder.encode(chunk)));
  return frames.concat(parser.finish());
}

test('keeps the trailing carriage return after the remaining partial event', () => {
  const frames = framesFromChunks(['data: ready\n\ndata: alpha\r', 'data: beta\r\r']);
  assert.deepEqual(frames, [{ data: 'ready' }, { data: 'alpha\nbeta' }]);
});

test('assembles UTF-8 events across every byte split and dispatches empty data', () => {
  const parser = new SSEParser();
  const bytes = encoder.encode('data: Café 🌍\r\ndata: two\r\n\r\ndata:\r\n\r\n');
  const frames = [];
  for (const byte of bytes) frames.push(...parser.push(Uint8Array.of(byte)));
  frames.push(...parser.finish());
  assert.deepEqual(frames, [{ data: 'Café 🌍\ntwo' }, { data: '' }]);
});

test('ignores comments and non-data-only events', () => {
  assert.deepEqual(framesFromChunks([': heartbeat\n\nevent: ping\n\ndata: ok\n\n']), [{ data: 'ok' }]);
});

test('does not dispatch an event without its terminating blank line', () => {
  assert.deepEqual(framesFromChunks(['data: incomplete']), []);
});
