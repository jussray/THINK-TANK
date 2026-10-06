// src/lib/agents/pivot.ts
// Pivot Agent: Strategist persona.
// Reads current modules, identifies the three strongest retained components,
// generates one pivot direction per component.
// Never recommends abandoning an idea — only reframing it.

import { claude, MODELS, heliconeTag } from '@/lib/ai/client'
import type {
  SummaryContent,
  ProblemContent,
  SolutionContent,
  CustomerContent,
  ScorecardContent,
} from '@/types/modules'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RetainedComponent =
  | 'technology'
  | 'customer_segment'
  | 'problem_framing'
  | 'business_model'
  | 'team_insight'

export interface PivotDirection {
  retained_component: RetainedComponent
  direction_label: string      // ≤ 60 chars, e.g. "Same technology, new market"
  direction_summary: string    // 2–3 sentences
  direction_rationale: string  // why this component is worth keeping
  hypothesis: string           // the core testable hypothesis
}

export interface PivotContext {
  summary: SummaryContent
  problem: ProblemContent
  solution: SolutionContent
  customer: CustomerContent
  scorecard: ScorecardContent
  founderDoubt: string  // founder's stated concern from the pre-pivot conversation
}

// ─── Pivot Agent System Prompt ────────────────────────────────────────────────

const PIVOT_AGENT_SYSTEM = `You are the Think Tank Pivot Strategist.

A founder's idea has a low Market Score. Your job is to generate exactly three pivot directions
that give the idea a better path — not by abandoning it, but by reframing the strongest parts.

Rules:
- Each direction must retain a DIFFERENT component of the original idea:
  one retains the technology/approach, one retains the customer segment, one retains the problem framing.
  Use the retained_component field to label which one each direction keeps.
- Every direction must be genuinely different — not minor variations.
- Base each direction on specific evidence from the modules — never generic advice.
- The hypothesis field must be a single testable sentence: "If [assumption], then [outcome]."
- direction_label must be ≤ 60 characters and describe the pivot in plain language.
- Do NOT suggest giving up. Do NOT suggest "talking to more customers" as a direction.
- Return ONLY valid JSON. No markdown. No preamble.

Output format — exactly this structure:
{
  "directions": [
    {
      "retained_component": "technology",
      "direction_label": "...",
      "direction_summary": "...",
      "direction_rationale": "...",
      "hypothesis": "..."
    },
    {
      "retained_component": "customer_segment",
      "direction_label": "...",
      "direction_summary": "...",
      "direction_rationale": "...",
      "hypothesis": "..."
    },
    {
      "retained_component": "problem_framing",
      "direction_label": "...",
      "direction_summary": "...",
      "direction_rationale": "...",
      "hypothesis": "..."
    }
  ]
}`

// ─── Generate Directions ──────────────────────────────────────────────────────

export async function generatePivotDirections(
  ctx: PivotContext,
  ideaId: string
): Promise<PivotDirection[]> {
  const prompt = `
Current idea modules:

SUMMARY: ${JSON.stringify(ctx.summary)}
PROBLEM: ${JSON.stringify(ctx.problem)}
SOLUTION: ${JSON.stringify(ctx.solution)}
CUSTOMER: ${JSON.stringify(ctx.customer)}

Scorecard:
- Market score: ${ctx.scorecard.market.score}/10
- Market explanation: ${ctx.scorecard.market.explanation}
- Critic concerns: ${ctx.scorecard.critic_concerns.map(c => c.concern).join('; ')}

Founder's stated doubt about the current direction:
"${ctx.founderDoubt}"

Generate three pivot directions. Each must retain a different component listed above.`

  const response = await claude.messages.create(
    {
      model: MODELS.interview,  // Strategist uses same high-quality model
      max_tokens: 1800,
      system: PIVOT_AGENT_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    },
    heliconeTag(ideaId, 'pivot-agent')
  )

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(clean)
    return parsed.directions as PivotDirection[]
  } catch (err) {
    throw new Error(`[PivotAgent] Failed to parse directions: ${err}\n\nRaw: ${text.slice(0, 400)}`)
  }
}

// ─── Pre-pivot Conversation System Prompt ─────────────────────────────────────
// A short 4–6 turn conversation before directions are shown.
// Surfaces the founder's actual doubts — not the AI's assumptions.

export const PIVOT_CONVERSATION_SYSTEM = `You are the Think Tank Pivot Strategist.

The founder's Market Score is low. Before exploring alternatives, you need to understand
what they themselves believe is not working.

Rules:
- Ask exactly ONE question per turn.
- Do not offer pivot directions yet — that comes after this conversation.
- Surface the founder's own diagnosis: what do THEY think is the core problem with the current direction?
- After 3–4 turns, signal readiness: tell the founder you have enough to generate pivot directions.
- Keep questions specific — reference the actual idea content, not generic startup advice.
- Never say "great point" or validate prematurely. Receive and probe.`

// ─── Branch Scorecard ─────────────────────────────────────────────────────────
// Generates a lightweight scorecard for a pivot branch after exploration interview.
// Only scores market and clarity — the two most changed dimensions.

export async function scorePivotBranch(
  direction: PivotDirection,
  explorationTranscript: string,
  originalScorecard: ScorecardContent,
  ideaId: string
): Promise<Partial<ScorecardContent>> {
  const prompt = `
Original idea scorecard for reference:
${JSON.stringify(originalScorecard)}

Pivot direction being explored:
${JSON.stringify(direction)}

Exploration interview transcript:
${explorationTranscript}

Score ONLY the market and clarity dimensions for this pivot direction.
Return JSON:
{
  "market":  { "score": 0, "explanation": "...", "improvement_path": "..." },
  "clarity": { "score": 0, "explanation": "...", "improvement_path": "..." }
}`

  const response = await claude.messages.create(
    {
      model: MODELS.scorer,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    },
    heliconeTag(ideaId, 'pivot-scorer')
  )

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {}
  }
}
