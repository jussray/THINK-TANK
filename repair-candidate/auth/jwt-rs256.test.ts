// Regression tests for the dependency-free RS256 JWT verifier.
// Run: node --test repair-candidate/auth/jwt-rs256.test.ts
// No network, no installed packages: keys are generated in-process.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign as cryptoSign, createHmac } from 'node:crypto'
import { verifyRS256Jwt } from './jwt-rs256.ts'

const ISS = 'https://auth.example.test/'
const AUD = 'think-tank-api'
const NOW = 1_800_000_000

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' }] }
const config = { jwks, issuer: ISS, audience: AUD, now: NOW }

const b64u = (x: Buffer | string) => Buffer.from(x).toString('base64url')

function mint(
  payload: Record<string, unknown>,
  opts: { alg?: string; kid?: string | null; key?: typeof privateKey } = {},
): string {
  const header: Record<string, unknown> = { alg: opts.alg ?? 'RS256', typ: 'JWT' }
  if (opts.kid !== null) header.kid = opts.kid ?? 'k1'
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`
  const sig = cryptoSign('RSA-SHA256', Buffer.from(signingInput), opts.key ?? privateKey)
  return `${signingInput}.${sig.toString('base64url')}`
}

const base = () => ({ sub: 'user_123', iss: ISS, aud: AUD, iat: NOW, nbf: NOW - 10, exp: NOW + 600 })

test('valid token returns the verified subject', () => {
  const out = verifyRS256Jwt(mint(base()), config)
  assert.equal(out?.sub, 'user_123')
})

test('payload tampered after signing is rejected', () => {
  const [h, , s] = mint(base()).split('.')
  const forged = `${h}.${b64u(JSON.stringify({ ...base(), sub: 'admin' }))}.${s}`
  assert.equal(verifyRS256Jwt(forged, config), null)
})

test('forged sub signed by a different key is rejected', () => {
  const token = mint({ ...base(), sub: 'admin' }, { key: attacker.privateKey })
  assert.equal(verifyRS256Jwt(token, config), null)
})

test('alg none with an empty signature is rejected', () => {
  const token = `${b64u(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'k1' }))}.${b64u(JSON.stringify({ ...base(), sub: 'admin' }))}.`
  assert.equal(verifyRS256Jwt(token, config), null)
})

test('alg none carrying a real RS256 signature over the same bytes is rejected by the allowlist alone', () => {
  // This isolates the alg policy: the signature genuinely verifies under RSA-SHA256,
  // so only the header allowlist stops it.
  const header = b64u(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'k1' }))
  const payload = b64u(JSON.stringify({ ...base(), sub: 'admin' }))
  const sig = cryptoSign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')
  assert.equal(verifyRS256Jwt(`${header}.${payload}.${sig}`, config), null)
})

test('HS256 keyed with the public key PEM (algorithm confusion) is rejected', () => {
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'k1' }))
  const payload = b64u(JSON.stringify({ ...base(), sub: 'admin' }))
  const mac = createHmac('sha256', pem).update(`${header}.${payload}`).digest('base64url')
  assert.equal(verifyRS256Jwt(`${header}.${payload}.${mac}`, config), null)
})

test('expired token is rejected beyond the clock-skew allowance', () => {
  assert.equal(verifyRS256Jwt(mint({ ...base(), exp: NOW - 60 }), config), null)
})

test('token not yet valid (nbf in the future) is rejected', () => {
  assert.equal(verifyRS256Jwt(mint({ ...base(), nbf: NOW + 300 }), config), null)
})

test('missing exp is rejected', () => {
  const { exp: _omit, ...noExp } = base()
  assert.equal(verifyRS256Jwt(mint(noExp), config), null)
})

test('wrong issuer is rejected', () => {
  assert.equal(verifyRS256Jwt(mint({ ...base(), iss: 'https://evil.example/' }), config), null)
})

test('wrong audience is rejected; audience array containing ours is accepted', () => {
  assert.equal(verifyRS256Jwt(mint({ ...base(), aud: 'other-api' }), config), null)
  assert.equal(verifyRS256Jwt(mint({ ...base(), aud: ['other-api', AUD] }), config)?.sub, 'user_123')
})

test('unknown kid is rejected', () => {
  assert.equal(verifyRS256Jwt(mint(base(), { kid: 'k2' }), config), null)
})

test('missing kid is rejected', () => {
  assert.equal(verifyRS256Jwt(mint(base(), { kid: null }), config), null)
})

test('missing or empty sub is rejected', () => {
  const { sub: _omit, ...noSub } = base()
  assert.equal(verifyRS256Jwt(mint(noSub), config), null)
  assert.equal(verifyRS256Jwt(mint({ ...base(), sub: '' }), config), null)
})

test('JWKS entry carrying private key material is rejected', () => {
  const privateJwks = { keys: [{ ...privateKey.export({ format: 'jwk' }), kid: 'k1' }] }
  assert.equal(verifyRS256Jwt(mint(base()), { ...config, jwks: privateJwks }), null)
})

test('malformed tokens are rejected without throwing', () => {
  for (const bad of ['', 'a.b', 'a.b.c.d', '!!!.@@@.###', 'eyJhbGciOiJSUzI1NiJ9.notjson.sig']) {
    assert.equal(verifyRS256Jwt(bad, config), null, `input: ${bad}`)
  }
})
