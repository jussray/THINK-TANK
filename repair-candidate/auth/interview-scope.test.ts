// Regression tests for the interview ownership helper (helper level only).
// Run: node --test repair-candidate/auth/interview-scope.test.ts
// Route-level and procedure-level cross-user denial are NOT covered here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAccessInterview, type InterviewScope } from './interview-scope.ts'

const scope: InterviewScope = { sessionId: 's1', ideaId: 'i1', ownerId: 'user_owner' }

test('the owner of the session and idea is allowed', () => {
  assert.equal(canAccessInterview('user_owner', 's1', 'i1', scope), true)
})

test('a different verified user is denied (cross-user)', () => {
  assert.equal(canAccessInterview('user_other', 's1', 'i1', scope), false)
})

test('no verified identity is denied', () => {
  assert.equal(canAccessInterview(null, 's1', 'i1', scope), false)
  assert.equal(canAccessInterview('', 's1', 'i1', scope), false)
})

test('a missing scope record is denied', () => {
  assert.equal(canAccessInterview('user_owner', 's1', 'i1', null), false)
})

test('a scope with no owner is denied', () => {
  const noOwner = { ...scope, ownerId: undefined } as unknown as InterviewScope
  assert.equal(canAccessInterview('user_owner', 's1', 'i1', noOwner), false)
})

test('a session id mismatch is denied even for the owner', () => {
  assert.equal(canAccessInterview('user_owner', 's2', 'i1', scope), false)
})

test('an idea id mismatch is denied even for the owner', () => {
  assert.equal(canAccessInterview('user_owner', 's1', 'i2', scope), false)
})
