// src/lib/agents/synthesis.ts
// Synthesis Agent: receives concept map + transcript, generates core modules.
// Never fabricates market data — leaves market figures as placeholders for Researcher Agent.
// All inferred claims are flagged in confidence_map.

import { claude, MODELS, heliconeTag } from '@/lib/ai/client'
import type {
  ConceptMap,
  SummaryContent,
  ProblemContent,
  SolutionContent,
  CustomerContent,
} from '@/types/modules'

export interface SynthesisInput {
  ideaId: string
  transcript: string        // full session transcript, concatenated
  conceptMap: ConceptMap
  sessionNumber: number
}

export interface SynthesisOutput {
  summary:  { content: SummaryContent;  confidence_map: Record<string, string> }
  problem:  { content: ProblemContent;  confidence_map: Record<string, string> }
  solution: { content: SolutionContent; confidence_map: Record<string, string> }
  customer: { content: CustomerContent; confidence_map: Record<string, string> }
}

const SYNTHESIS_SYSTEM = `You are the Think Tank Synthesis Agent.

Your job: extract structured module content from a founder interview transcript.

Rules:
- Every claim must be traceable to something the founder actually said.
- If a claim is derived from what the founder implied (not stated), mark it "inferred" in the confidence_map.
- If a claim is directly stated by the founder, mark it "stated".
- NEVER fabricate market size figures, competitor names, or revenue projections.
  Leave those fields as empty strings with a note: "[Requires Researcher Agent]"
- Write in clear, professional prose — not bullet points inside string fields.
- Return ONLY valid JSON. No markdown. No explanation. No preamble.

The confidence_map keys correspond to the top-level fields of each module.`

export async function runSynthesisAgent(input: SynthesisInput): Promise<SynthesisOutput> {
  const prompt = `
Concept map state at session end:
${JSON.stringify(input.conceptMap, null, 2)}

Interview transcript (session ${input.sessionNumber}):
${input.transcript}

Generate the following four modules as a single JSON object with this exact structure:
{
  "summary": {
    "content": { "one_liner": "", "elevator_pitch": "", "core_insight": "", "tags": [] },
    "confidence_map": {}
  },
  "problem": {
    "content": { "problem_statement": "", "who_has_it": "", "current_solutions": [], "why_current_solutions_fail": "", "pain_intensity": "medium" },
    "confidence_map": {}
  },
  "solution": {
    "content": { "solution_description": "", "key_differentiators": [], "unfair_advantages": [], "technical_complexity": "medium" },
    "confidence_map": {}
  },
  "customer": {
    "content": { "primary_segment": "", "icp_description": "", "jobs_to_be_done": [], "persona_signals": [], "acquisition_hypothesis": "" },
    "confidence_map": {}
  }
}

Important: one_liner must be ≤ 140 characters. elevator_pitch must be 3–5 sentences.
`

  const response = await claude.messages.create(
    {
      model: MODELS.synthesis,
      max_tokens: 4000,
      system: SYNTHESIS_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    },
    heliconeTag(input.ideaId, 'synthesis')
  )

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    return JSON.parse(clean) as SynthesisOutput
  } catch (err) {
    throw new Error(`[SynthesisAgent] Failed to parse output: ${err}\n\nRaw: ${text.slice(0, 500)}`)
  }
}
