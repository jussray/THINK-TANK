// src/lib/agents/interview.ts
// Interview Agent: Socratic dialogue engine.
// Builds layered system prompt, streams responses, updates concept map after each turn.

import { claude, MODELS, heliconeTag } from '@/lib/ai/client'
import type { ConceptMap, InterviewMode, ModuleType } from '@/types/modules'

// ─── Layer 1: Invariant Agent Identity ────────────────────────────────────────

const AGENT_IDENTITY = `You are the Think Tank Interview Agent.

Your sole function is to understand a founder's idea as deeply as they do.

Rules you never break:
- Ask exactly ONE question per turn. Never two. Never a question with a sub-question embedded.
- Never give advice, validation, or evaluation. You are not a coach right now. You are a listener.
- Never say "great," "interesting," "fascinating," or any affirming filler. Receive what they say and ask the next question.
- If their answer is shallow or vague, probe deeper on the same topic before moving forward.
- If their answer is rich and complete, advance to the next dimension.
- When overall_completeness exceeds 0.75 across all dimensions, signal that you have enough for a first set of outputs.

The eight dimensions you are working to understand:
1. problem_clarity — What is the specific problem? Who specifically experiences it?
2. solution_specificity — What exactly are they building? What is the core mechanic?
3. customer_definition — Who is the first customer? Can they name a real person or company?
4. revenue_hypothesis — How does money flow? Who pays, how much, how often?
5. market_awareness — Do they understand the existing landscape? What have they looked at?
6. competitive_awareness — Who else is doing this, or adjacent to it?
7. founder_motivation — Why this founder, why this problem, why now?
8. execution_readiness — What have they already done? What is the next concrete action?

Move through dimensions in the order that the conversation naturally allows. Start with problem_clarity on session 1.`

// ─── Mode-specific instructions ───────────────────────────────────────────────

const MODE_INSTRUCTIONS: Record<InterviewMode, (target?: ModuleType | null) => string> = {
  initial: () =>
    `This is a first session. Start from the beginning. Your first question should draw out the problem they are solving.`,

  module_refine: (target) =>
    `This is a refinement session focused exclusively on the "${target}" module. 
The founder wants to deepen or correct that section only. 
Ignore other dimensions unless the founder explicitly raises them.
Your first question should probe the weakest or most inferred claim in that module.`,

  pivot: () =>
    `The founder is exploring a pivot. The original idea's history is preserved in context.
Help them think clearly about what to retain and what to change.
Your first question should surface what they believe is the strongest part of the current idea — the component worth keeping.`,

  checkin: () =>
    `This is a weekly check-in. Keep it focused and short (5–8 turns maximum).
Your first question: "Last session you committed to [most recent commitment from context]. Did you complete it?"
If yes, ask what was learned. If no, ask what blocked it — no judgment.`,

  discovery: () =>
    `You are now role-playing as the founder's target customer persona (described in context).
Respond as that customer would: with their vocabulary, their concerns, their skepticism.
The founder is practicing a customer discovery call. Push back where a real customer would.`,
}

// ─── System prompt builder ────────────────────────────────────────────────────

export interface InterviewContext {
  ideaContext: string | null      // from ai_memory_threads (idea_context type)
  founderContext: string | null   // from ai_memory_threads (founder_profile type)
  conceptMap: ConceptMap
  mode: InterviewMode
  targetModule: ModuleType | null
  sessionNumber: number
}

export function buildInterviewSystemPrompt(ctx: InterviewContext): string {
  const sections: string[] = [
    // Layer 1: Identity
    AGENT_IDENTITY,

    // Layer 2: Idea context (RAG-retrieved prior sessions)
    ctx.ideaContext
      ? `<idea_context>\n${ctx.ideaContext}\n</idea_context>`
      : `<idea_context>No prior sessions. This is session ${ctx.sessionNumber}.</idea_context>`,

    // Layer 3: Founder context (cross-idea Coach Agent memory)
    ctx.founderContext
      ? `<founder_context>\n${ctx.founderContext}\n</founder_context>`
      : '',

    // Layer 4: Mode instruction
    `<session_mode>\n${MODE_INSTRUCTIONS[ctx.mode](ctx.targetModule)}\n</session_mode>`,

    // Layer 5: Current concept map state
    `<concept_map>
${JSON.stringify(ctx.conceptMap, null, 2)}

Overall completeness: ${(ctx.conceptMap.overall_completeness * 100).toFixed(0)}%
When this reaches 75%+, close the session gracefully: summarize what you learned and tell the founder what will be generated.
</concept_map>`,
  ]

  return sections.filter(Boolean).join('\n\n')
}

// ─── Concept Map Updater ──────────────────────────────────────────────────────
// Called server-side after each assistant message. Never blocks the stream.

const CONCEPT_MAP_EXTRACTOR_PROMPT = `You update a structured concept map based on new content from an interview.

Return ONLY valid JSON — no explanation, no markdown fences, no preamble.
Update confidence scores based on how clearly the founder has expressed each dimension:
- 0.0–0.3: not yet addressed or very vague
- 0.4–0.6: mentioned but needs more depth
- 0.7–0.9: clearly articulated
- 1.0: fully defined, specific, no ambiguity

Recalculate overall_completeness as the arithmetic mean of all 8 dimension confidence scores.`

export async function updateConceptMap(
  currentMap: ConceptMap,
  newContent: string,
  ideaId: string
): Promise<ConceptMap> {
  const response = await claude.messages.create(
    {
      model: MODELS.interview,
      max_tokens: 600,
      system: CONCEPT_MAP_EXTRACTOR_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current concept map:\n${JSON.stringify(currentMap, null, 2)}\n\nNew content to integrate:\n${newContent}\n\nReturn the updated concept map JSON only.`,
        },
      ],
    },
    heliconeTag(ideaId, 'concept-map-updater')
  )

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    // Strip any accidental markdown fences before parsing
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    return JSON.parse(clean) as ConceptMap
  } catch {
    // If parsing fails, return the current map unchanged — never crash the session
    console.error('[ConceptMap] Parse failed, returning unchanged map:', text.slice(0, 200))
    return currentMap
  }
}

// ─── Session Readiness Check ──────────────────────────────────────────────────

export function isSessionReadyToEnd(conceptMap: ConceptMap): boolean {
  return conceptMap.overall_completeness >= 0.75
}

// ─── Empty Concept Map (seed for new sessions) ────────────────────────────────

export function emptyConceptMap(): ConceptMap {
  const emptyDimension = { value: '', confidence: 0 }
  return {
    problem_clarity:       { ...emptyDimension },
    solution_specificity:  { ...emptyDimension },
    customer_definition:   { ...emptyDimension },
    revenue_hypothesis:    { ...emptyDimension },
    market_awareness:      { ...emptyDimension },
    competitive_awareness: { ...emptyDimension },
    founder_motivation:    { ...emptyDimension },
    execution_readiness:   { ...emptyDimension },
    overall_completeness:  0,
  }
}
