// Regression tests for the candidate Bearer identity boundary.
// Run: node --test repair-candidate/auth/verified-identity.test.ts
// Serves JWKS from a real loopback HTTP server so the fetch path is exercised. No external network.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { generateKeyPairSync, sign as cryptoSign, createHmac } from 'node:crypto'
import { verifyBearerIdentity } from './verified-identity.ts'

const ISS = 'https://clerk.example.test'
const AUD = 'think-tank-api'

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwksBody = JSON.stringify({
  keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' }],
})

let server: Server
let jwksUrl = ''

before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/jwks') res.writeHead(200, { 'content-type': 'application/json' }).end(jwksBody)
    else if (req.url === '/down') res.writeHead(500).end('unavailable')
    else if (req.url === '/text') res.writeHead(200, { 'content-type': 'text/plain' }).end('not json')
    else if (req.url === '/redirect') res.writeHead(302, { location: '/jwks' }).end()
    else res.writeHead(404).end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('no loopback address')
  jwksUrl = `http://127.0.0.1:${addr.port}/jwks`
})

after(() => new Promise<void>(resolve => server.close(() => resolve())))

const b64u = (x: Buffer | string) => Buffer.from(x).toString('base64url')
const nowSec = () => Math.floor(Date.now() / 1000)
const claims = () => ({ sub: 'user_123', iss: ISS, aud: AUD, iat: nowSec(), nbf: nowSec() - 10, exp: nowSec() + 600 })
const cfg = () => ({ issuer: ISS, audience: AUD, jwksUrl })

function mint(payload: Record<string, unknown>, opts: { kid?: string; key?: typeof privateKey } = {}): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: opts.kid ?? 'k1' }
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`
  const sig = cryptoSign('RSA-SHA256', Buffer.from(signingInput), opts.key ?? privateKey)
  return `${signingInput}.${sig.toString('base64url')}`
}

test('accepts a validly signed token and returns the verified subject and token', async () => {
  const token = mint(claims())
  const id = await verifyBearerIdentity(`Bearer ${token}`, cfg())
  assert.deepEqual(id, { userId: 'user_123', token })
})

test('rejects a missing, non-Bearer, or malformed Authorization header', async () => {
  for (const header of [null, '', 'Basic abc', 'Bearer', 'Bearer a b']) {
    assert.equal(await verifyBearerIdentity(header, cfg()), null, `header: ${header}`)
  }
})

test('rejects when any required configuration value is empty', async () => {
  const token = `Bearer ${mint(claims())}`
  assert.equal(await verifyBearerIdentity(token, { ...cfg(), issuer: '' }), null)
  assert.equal(await verifyBearerIdentity(token, { ...cfg(), audience: '' }), null)
  assert.equal(await verifyBearerIdentity(token, { ...cfg(), jwksUrl: '' }), null)
})

test('rejects a tampered payload', async () => {
  const [h, , s] = mint(claims()).split('.')
  const forged = `${h}.${b64u(JSON.stringify({ ...claims(), sub: 'admin' }))}.${s}`
  assert.equal(await verifyBearerIdentity(`Bearer ${forged}`, cfg()), null)
})

test('rejects a forged subject signed by a key that is not in the JWKS', async () => {
  const token = mint({ ...claims(), sub: 'admin' }, { key: attacker.privateKey })
  assert.equal(await verifyBearerIdentity(`Bearer ${token}`, cfg()), null)
})

test('rejects an unsupported algorithm (HS256 keyed with the public PEM)', async () => {
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'k1' }))
  const payload = b64u(JSON.stringify({ ...claims(), sub: 'admin' }))
  const mac = createHmac('sha256', pem).update(`${header}.${payload}`).digest('base64url')
  assert.equal(await verifyBearerIdentity(`Bearer ${header}.${payload}.${mac}`, cfg()), null)
})

test('rejects an expired token', async () => {
  assert.equal(await verifyBearerIdentity(`Bearer ${mint({ ...claims(), exp: nowSec() - 120 })}`, cfg()), null)
})

test('rejects a wrong issuer', async () => {
  assert.equal(await verifyBearerIdentity(`Bearer ${mint({ ...claims(), iss: 'https://evil.example' })}`, cfg()), null)
})

test('rejects a wrong audience', async () => {
  assert.equal(await verifyBearerIdentity(`Bearer ${mint({ ...claims(), aud: 'other-api' })}`, cfg()), null)
})

test('rejects a token with no aud claim when an audience is configured', async () => {
  // Documents the open risk: a default Clerk session token without aud is rejected, not accepted.
  const { aud: _omit, ...noAud } = claims()
  assert.equal(await verifyBearerIdentity(`Bearer ${mint(noAud)}`, cfg()), null)
})

test('rejects a missing or empty subject', async () => {
  const { sub: _omit, ...noSub } = claims()
  assert.equal(await verifyBearerIdentity(`Bearer ${mint(noSub)}`, cfg()), null)
  assert.equal(await verifyBearerIdentity(`Bearer ${mint({ ...claims(), sub: '' })}`, cfg()), null)
})

test('rejects a kid that is not in the JWKS', async () => {
  assert.equal(await verifyBearerIdentity(`Bearer ${mint(claims(), { kid: 'k-unknown' })}`, cfg()), null)
})

test('fails closed when the JWKS endpoint returns an error status', async () => {
  const down = { ...cfg(), jwksUrl: jwksUrl.replace('/jwks', '/down') }
  assert.equal(await verifyBearerIdentity(`Bearer ${mint(claims())}`, down), null)
})

test('fails closed when the JWKS body is not JSON', async () => {
  const text = { ...cfg(), jwksUrl: jwksUrl.replace('/jwks', '/text') }
  assert.equal(await verifyBearerIdentity(`Bearer ${mint(claims())}`, text), null)
})

test('fails closed when the JWKS endpoint redirects', async () => {
  const redirect = { ...cfg(), jwksUrl: jwksUrl.replace('/jwks', '/redirect') }
  assert.equal(await verifyBearerIdentity(`Bearer ${mint(claims())}`, redirect), null)
})

test('fails closed when the JWKS endpoint is unreachable', async () => {
  const refused = { ...cfg(), jwksUrl: 'http://127.0.0.1:1/jwks' }
  assert.equal(await verifyBearerIdentity(`Bearer ${mint(claims())}`, refused), null)
})

test('rejects a non-HTTPS JWKS URL for a non-loopback host without fetching it', async () => {
  const insecure = { ...cfg(), jwksUrl: 'http://jwks.invalid.example/jwks' }
  assert.equal(await verifyBearerIdentity(`Bearer ${mint(claims())}`, insecure), null)
})
