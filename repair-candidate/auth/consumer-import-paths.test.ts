// Candidate-only structural regression check; no Next.js or Supabase installation needed.
// Run: node --test repair-candidate/auth/consumer-import-paths.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const routeUrl = new URL('../api/interview/stream/route.ts', import.meta.url)
const trpcUrl = new URL('../server/trpc.ts', import.meta.url)

test('stream route resolves both verified auth dependencies from its own location', () => {
  const source = readFileSync(routeUrl, 'utf8')
  const authImports = [...source.matchAll(/from\s+['"](\.{1,2}\/[^'"]*\/auth\/[^'"]+)['"]/g)]
    .map(match => match[1])
  const expected = ['../../../auth/interview-scope', '../../../auth/verified-identity']
  assert.deepEqual(authImports.sort(), expected.sort())
  for (const specifier of authImports) {
    assert.equal(existsSync(new URL(specifier + '.ts', routeUrl)), true, 'Cannot resolve ' + specifier)
  }
})

test('active candidate consumers do not decode identity using atob', () => {
  for (const url of [routeUrl, trpcUrl]) {
    const source = readFileSync(url, 'utf8')
    assert.doesNotMatch(source, /\batob\s*\(/, url.pathname)
    assert.match(source, /verifyBearerIdentity\s*\(/, url.pathname)
  }
})
