// Dependency-free RS256 JWT verifier (node:crypto only).
// Contract: returns the verified subject, or null for ANY failure. Never throws.
// The caller owns JWKS fetch and caching; this module only verifies against the keys it is given.
// Policy: RS256 only (rejects none and HS256 key confusion), kid required, private key material rejected,
// exp required, nbf/iss/aud checked, sub required as a non-empty string.
import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from 'node:crypto'

export interface VerifyConfig {
  jwks: { keys: Array<JsonWebKey & { kid?: string }> }
  issuer: string
  audience: string
  now?: number // seconds since epoch; injectable for tests
  clockSkewSeconds?: number // default 30
}

export interface VerifiedToken {
  sub: string
  claims: Record<string, unknown>
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function decodeSegment(segment: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error('invalid base64url segment')
  return Buffer.from(segment, 'base64url')
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(decodeSegment(segment).toString('utf8'))
  if (!isRecord(parsed)) throw new Error('segment is not a JSON object')
  return parsed
}

export function verifyRS256Jwt(token: string, config: VerifyConfig): VerifiedToken | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, signatureB64] = parts

    const header = decodeJsonSegment(headerB64)
    if (header.alg !== 'RS256') return null
    if (typeof header.kid !== 'string' || header.kid.length === 0) return null

    const jwk = config.jwks.keys.find(k => k.kid === header.kid)
    if (!jwk || jwk.kty !== 'RSA') return null
    if ('d' in jwk) return null // private key material must never sit in a verification JWKS

    const key = createPublicKey({ key: jwk, format: 'jwk' })
    const signatureOk = cryptoVerify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      key,
      decodeSegment(signatureB64),
    )
    if (!signatureOk) return null

    const claims = decodeJsonSegment(payloadB64)
    const now = config.now ?? Math.floor(Date.now() / 1000)
    const skew = config.clockSkewSeconds ?? 30

    if (typeof claims.exp !== 'number' || claims.exp + skew <= now) return null
    if (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf - skew > now)) return null
    if (claims.iss !== config.issuer) return null

    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!audience.includes(config.audience)) return null

    if (typeof claims.sub !== 'string' || claims.sub.length === 0) return null

    return { sub: claims.sub, claims }
  } catch {
    return null
  }
}
