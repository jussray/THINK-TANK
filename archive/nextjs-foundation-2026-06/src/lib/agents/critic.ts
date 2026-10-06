// src/lib/agents/critic.ts
// Critic Agent: GPT-4o, adversarial, produces specific substantiated concerns.
// Scorer Agent: Claude, synthesizes modules + critic concerns into Scorecard module.

import { claude, openai, MODELS, heliconeTag } from '@/lib/ai/client'
import type { ScorecardContent, ModuleType } from '@/types/modules'
import type { SynthesisOutput } from './synthesis'

// ─── Critic Agent ─────────────────────────────────────────────────────────────

export interface CriticConcern {
  concern: string
  tied_to_module: ModuleType
}

const CRITIC_SYSTEM = `You are the Think Tank Critic Agent. You find the holes in startup ideas.

Rules:
- Generate exactly 3 concerns. No more. No fewer.
- Every concern must be a specific question an investor or experienced founder would ask.
  Good: "Who is already doing this in the pharmacy vertical, and why haven't they won?"
  Bad: "The market may be competitive."
- Every concern must be tied to a specific module (summary, problem, solution, or customer).
- Do not generate praise. Do not soften concerns. Be direct.
- Return ONLY valid JSON. No markdown. No explanation.

Output format:
[
  { "concern": "...", "tied_to_module": "problem" },
  { "concern": "...", "tied_to_module": "solution" },
  { "concern": "...", "tied_to_module": "customer" }
]`

export async function runCriticAgent(
  modules: SynthesisOutput,
  ideaId: string
): Promise<CriticConcern[]> {
  const prompt = `
Startup modules to critique:

SUMMARY: ${JSON.stringify(modules.summary.content)}
PROBLEM: ${JSON.stringify(modules.problem.content)}
SOLUTION: ${JSON.stringify(modules.solution.content)}
CUSTOMER: ${JSON.stringify(modules.customer.content)}

Generate 3 specific investor-grade concerns.`

  const response = await openai.chat.completions.create(
    {
      model: MODELS.critic,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CRITIC_SYSTEM },
        { role: 'user', content: prompt },
      ],
    } as Parameters<typeof openai.chat.completions.create>[0],
    heliconeTag(ideaId, 'critic') as never
  )

  const text = response.choices[0]?.message?.content ?? '[]'

  try {
    // GPT-4o with response_format json_object wraps arrays in an object
    const parsed = JSON.parse(text)
    // Handle both {concerns: [...]} and [...] shapes
    const concerns = Array.isArray(parsed) ? parsed : (parsed.concerns ?? parsed.items ?? [])
    return concerns as CriticConcern[]
  } catch {
    console.error('[CriticAgent] Parse failed:', text.slice(0, 200))
    return []
  }
}

// ─── Scorer Agent ─────────────────────────────────────────────────────────────

const SCORER_SYSTEM = `You are the Think Tank Scorer Agent.

Score a startup idea across five dimensions, each from 1–10.
Base scores strictly on the module content provided — do not extrapolate.
If evidence is thin, score low and say why.

Return ONLY valid JSON matching this exact structure. No markdown. No preamble.

{
  "clarity":     { "score": 7, "explanation": "...", "improvement_path": "..." },
  "market":      { "score": 5, "explanation": "...", "improvement_path": "..." },
  "difficulty":  { "score": 6, "explanation": "...", "improvement_path": "..." },
  "scalability": { "score": 8, "explanation": "...", "improvement_path": "..." },
  "readiness":   { "score": 4, "explanation": "...", "improvement_path": "..." }
}

Dimension definitions:
- clarity:     How well-defined is the problem and solution? Are they specific?
- market:      Is there evidence of real market demand? Is the size meaningful?
- difficulty:  How hard is this to build? (Lower score = easier, higher = harder — score against appropriate difficulty for this type of idea)
- scalability: Can this grow without proportional headcount increase?
- readiness:   How prepared is this founder to execute? Evidence of action taken?

explanation: 2–3 sentences specific to THIS idea — never generic.
improvement_path: one concrete action the founder can take to improve this score.`

export async function runScorerAgent(
  modules: SynthesisOutput,
  concerns: CriticConcern[],
  ideaId: string,
  sessionNumber: number
): Promise<ScorecardContent> {
  const prompt = `
Modules:
${JSON.stringify(modules, null, 2)}

Critic concerns:
${JSON.stringify(concerns, null, 2)}

Score this idea across five dimensions.`

  const response = await claude.messages.create(
    {
      model: MODELS.scorer,
      max_tokens: 1500,
      system: SCORER_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    },
    heliconeTag(ideaId, 'scorer')
  )

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    const scores = JSON.parse(clean)

    const marketScore: number = scores.market?.score ?? 10
    const pivotTriggered = marketScore < 4

    return {
      ...scores,
      critic_concerns: concerns,
      pivot_mode_triggered: pivotTriggered,
      generated_from_session: sessionNumber,
    } as ScorecardContent
  } catch (err) {
    throw new Error(`[ScorerAgent] Failed to parse output: ${err}`)
  }
}
