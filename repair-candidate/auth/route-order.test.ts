// Candidate-only STRUCTURAL guard for the stream route's security ordering.
// Locks: verified identity -> service-role client -> ownership check -> stream and any database write.
// This is source-order evidence only. It does NOT prove runtime denial; runtime route tests need the app's dependencies.
// Run: node --test repair-candidate/auth/route-order.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routeUrl = new URL('../api/interview/stream/route.ts', import.meta.url)

function onlyIndex(source: string, needle: string): number {
  const first = source.indexOf(needle)
  assert.notEqual(first, -1, 'missing: ' + needle)
  assert.equal(source.indexOf(needle, first + 1), -1, 'ambiguous: ' + needle)
  return first
}

test('stream route verifies identity before creating the service-role client', () => {
  const source = readFileSync(routeUrl, 'utf8')
  const verify = onlyIndex(source, 'await verifyBearerIdentity(')
  const serviceClient = onlyIndex(source, 'createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)')
  assert.ok(verify < serviceClient, 'service-role client created before identity verification')
})

test('stream route checks ownership before the stream starts and before any write', () => {
  const source = readFileSync(routeUrl, 'utf8')
  const serviceClient = onlyIndex(source, 'createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)')
  const ownership = onlyIndex(source, '!canAccessInterview(')
  const firstWrite = source.indexOf('.insert(')
  const firstUpdate = source.indexOf('.update(')
  const firstStream = onlyIndex(source, 'claude.messages.stream(')
  assert.ok(serviceClient < ownership, 'ownership check runs before the service-role client exists')
  assert.notEqual(firstWrite, -1, 'expected a write to guard')
  assert.ok(ownership < firstWrite, 'a database insert runs before the ownership check')
  assert.ok(ownership < firstUpdate, 'a database update runs before the ownership check')
  assert.ok(ownership < firstStream, 'the model stream starts before the ownership check')
})
