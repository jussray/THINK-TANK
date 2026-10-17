// Candidate authentication boundary for the recovered June foundation.
// This file is outside the immutable historical archive.
// Requires CLERK_JWT_ISSUER, CLERK_JWT_AUDIENCE and CLERK_JWKS_URL to be configured.
// Verification uses the dependency-free RS256 verifier (node:crypto). No decoded payload is trusted before signature verification.
// Fails closed: any missing config, JWKS failure, or verification failure returns null.
import { verifyRS256Jwt, type VerifyConfig } from './jwt-rs256.ts'

export interface VerifiedIdentity {
  userId: string
  token: string
}

const JWKS_TIMEOUT_MS = 3000

// The JWKS URL is trusted configuration. HTTPS is required, except for loopback hosts (tests and local dev).
function isAllowedJwksUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
}

async function fetchJwks(jwksUrl: string): Promise<VerifyConfig['jwks'] | null> {
  if (!isAllowedJwksUrl(jwksUrl)) return null
  // redirect: 'error' keeps the fetch pinned to the configured endpoint.
  const res = await fetch(jwksUrl, { signal: AbortSignal.timeout(JWKS_TIMEOUT_MS), redirect: 'error' })
  if (!res.ok) return null
  const body: unknown = await res.json()
  if (!body || typeof body !== 'object' || !Array.isArray((body as { keys?: unknown }).keys)) return null
  return body as VerifyConfig['jwks']
}

export async function verifyBearerIdentity(
  authorization: string | null,
  config: { issuer: string; audience: string; jwksUrl: string }
): Promise<VerifiedIdentity | null> {
  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '')
  if (!match || !config.issuer || !config.audience || !config.jwksUrl) return null
  try {
    const jwks = await fetchJwks(config.jwksUrl)
    if (!jwks) return null
    const verified = verifyRS256Jwt(match[1], {
      jwks,
      issuer: config.issuer,
      audience: config.audience,
    })
    return verified ? { userId: verified.sub, token: match[1] } : null
  } catch {
    return null
  }
}
