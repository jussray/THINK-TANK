// src/lib/ai/client.ts
// Single import point for all AI calls.
// Helicone proxy wraps every request for cost/quality observability.
// Never import Anthropic SDK directly anywhere else in the codebase.

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

// ─── Claude (Interview, Synthesis, Scorer, Coach) ─────────────────────────────

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: 'https://oai.hconeai.com',
  defaultHeaders: {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    'Helicone-Property-App': 'think-tank',
    'Helicone-Property-Environment': process.env.NODE_ENV ?? 'development',
  },
})

// ─── OpenAI (Critic Agent, Embeddings) ────────────────────────────────────────

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: 'https://oai.hconeai.com/v1',
  defaultHeaders: {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    'Helicone-Property-App': 'think-tank',
    'Helicone-Property-Environment': process.env.NODE_ENV ?? 'development',
  },
})

// ─── Model Constants ──────────────────────────────────────────────────────────

export const MODELS = {
  interview:  'claude-sonnet-4-20250514',  // sustained conversation, instruction following
  synthesis:  'claude-sonnet-4-20250514',  // long-context module generation
  critic:     'gpt-4o',                    // adversarial, direct
  scorer:     'claude-sonnet-4-20250514',
  coach:      'claude-sonnet-4-20250514',  // conversational quality paramount
  embedding:  'text-embedding-3-small',    // 1536-dim, cost-effective
} as const

// ─── Per-call Helicone tagging ────────────────────────────────────────────────
// Usage: claude.messages.create({ ...params }, heliconeTag(ideaId, 'interview'))

export function heliconeTag(ideaId: string, agent: string): { headers: Record<string, string> } {
  return {
    headers: {
      'Helicone-Property-IdeaId': ideaId,
      'Helicone-Property-Agent': agent,
    },
  }
}

// ─── Embedding helper ─────────────────────────────────────────────────────────

export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: MODELS.embedding,
    input: text.slice(0, 8000),  // truncate to avoid token limit errors
  })
  return response.data[0].embedding
}
