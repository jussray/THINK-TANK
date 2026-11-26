// Pure authorization helper for interview requests.
// Use only after cryptographic identity verification.
export interface InterviewScope {
  sessionId: string
  ideaId: string
  ownerId: string
}
export function canAccessInterview(
  verifiedUserId: string | null,
  requestedSessionId: string,
  requestedIdeaId: string,
  scope: InterviewScope | null
): boolean {
  return Boolean(
    verifiedUserId &&
    scope &&
    scope.sessionId === requestedSessionId &&
    scope.ideaId === requestedIdeaId &&
    scope.ownerId === verifiedUserId
  )
}
