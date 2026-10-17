import { z } from 'zod';

export const AnswerSchema = z.object({
  answer: z.string().trim().min(1).max(8000),
  idempotencyKey: z.string().min(12).max(128).regex(/^[A-Za-z0-9_-]+$/)
}).strict();

export const QuestionSchema = z.object({
  next_question: z.string().trim().min(1).max(1000)
}).strict();

export const INTERVIEWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { next_question: {type:'string'} },
  required: ['next_question']
} as const;

export function assertQuestion(payload: unknown): string {
  return QuestionSchema.parse(payload).next_question;
}
export function errorCode(error: unknown): string {
  if (error instanceof z.ZodError) return 'INVALID_MODEL_OUTPUT';
  if (error instanceof Error && error.name === 'TimeoutError') return 'MODEL_TIMEOUT';
  return 'MODEL_EXECUTION_FAILED';
}

export function requestFingerprint(ideaId:string, answer:string): string {
  // Pure deterministic input for the caller to hash with node:crypto.
  return JSON.stringify({v:1,ideaId,answer:answer.trim()});
}
