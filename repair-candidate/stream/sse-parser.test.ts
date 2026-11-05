// Regression tests for the buffered SSE parser.
// Run: node --test repair-candidate/stream/sse-parser.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SSEParser } from './sse-parser.ts'

const enc = new TextEncoder()
const datas = (frames: { data: string }[]) => frames.map(f => f.data)

test('LF frames split across chunks are all delivered', () => {
  const p = new SSEParser()
  const out = [
    ...p.push(enc.encode('data: a\n\ndata: b\n')),
    ...p.push(enc.encode('\n')),
    ...p.finish(),
  ]
  assert.deepEqual(datas(out), ['a', 'b'])
})

test('CRLF terminator split across the chunk boundary is joined', () => {
  const p = new SSEParser()
  const out = [
    ...p.push(enc.encode('data: x\r\n\r')),
    ...p.push(enc.encode('\ndata: y\r\n\r\n')),
    ...p.finish(),
  ]
  assert.deepEqual(datas(out), ['x', 'y'])
})

test('bare-CR terminators split across chunks keep every following frame', () => {
  const p = new SSEParser()
  const out = [
    ...p.push(enc.encode('data: one\r\rdata: two\r\r')),
    ...p.push(enc.encode('data: three\r\r')),
    ...p.finish(),
  ]
  assert.deepEqual(datas(out), ['one', 'two', 'three'])
})

test('a final CR-terminated event is flushed on finish', () => {
  const p = new SSEParser()
  const out = [...p.push(enc.encode('data: last\r\r')), ...p.finish()]
  assert.deepEqual(datas(out), ['last'])
})

test('a multi-byte UTF-8 character split across chunks decodes intact', () => {
  const p = new SSEParser()
  const bytes = enc.encode('data: héllo\n\n')
  const out = [...p.push(bytes.slice(0, 8)), ...p.push(bytes.slice(8)), ...p.finish()]
  assert.deepEqual(datas(out), ['héllo'])
})

test('an incomplete trailing frame is discarded at end of stream', () => {
  const p = new SSEParser()
  const out = [...p.push(enc.encode('data: partial\n')), ...p.finish()]
  assert.deepEqual(datas(out), [])
})
