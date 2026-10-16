// Candidate authentication boundary for the recovered June foundation.
// This file is outside the immutable historical archive.
// Requires CLERK_JWT_ISSUER, CLERK_JWT_AUDIENCE and CLERK_JWKS_URL to be configured.
// Do not trust a decoded JWT payload before cryptographic verification.
import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface VerifiedIdentity {
  userId: string
  token: string
}

export async function verifyBearerIdentity(
  authorization: string | null,
  config: { issuer: string; audience: string; jwksUrl: string }
): Promise<VerifiedIdentity | null> {
  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '')
  if (!match || !config.issuer || !config.audience || !config.jwksUrl) return null
  try {
    const jwks = createRemoteJWKSet(new URL(config.jwksUrl))
    const { payload } = await jwtVerify(match[1], jwks, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['RS256'],
    })
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    return { userId: payload.sub, token: match[1] }
  } catch {
    return null
  }
}
