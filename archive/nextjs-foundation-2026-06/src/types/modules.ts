// src/types/modules.ts
// Canonical content_json shapes for every module type.
// Adding a new module: add its type here + add to ModuleType union.
// Zero database changes required.

export type ModuleType =
  | 'summary'
  | 'problem'
  | 'solution'
  | 'customer'
  | 'scorecard'
  | 'revenue'
  | 'roadmap'
  | 'pitch'
  | 'action_plan'
  | 'growth_strategy'
  | 'competitive_landscape'
  | 'discovery_synthesis'

export type GenerationStatus = 'pending' | 'generating' | 'complete' | 'error' | 'draft'
export type EditSource = 'user' | 'ai' | 'system'
export type InterviewMode = 'initial' | 'module_refine' | 'pivot' | 'checkin' | 'discovery'
export type AgentPersona = 'interview' | 'synthesis' | 'critic' | 'scorer' | 'coach' | 'researcher' | 'matchmaker'
export type IdeaStage = 'idea' | 'blueprint' | 'prototype' | 'beta' | 'revenue' | 'growth'
export type PrivacyStatus = 'private' | 'public' | 'listed'
export type FounderMode = 'dreamer' | 'builder' | 'investor' | 'team_builder'

// ─── Database Row Types ────────────────────────────────────────────────────────

export interface Profile {
  id: string
  display_name: string | null
  bio: string | null
  domain_tags: string[]
  avatar_url: string | null
  founder_mode: FounderMode
  is_public: boolean
  reputation_score: number
  created_at: string
  updated_at: string
}

export interface Idea {
  id: string
  owner_id: string
  title: string
  slug: string
  stage: IdeaStage
  privacy_status: PrivacyStatus
  marketplace_status: 'active' | 'paused' | 'closed' | null
  vault_flag: boolean
  current_version_id: string | null
  created_at: string
  updated_at: string
}

export interface IdeaVersion {
  id: string
  idea_id: string
  version_number: number
  snapshot_json: Record<string, unknown>
  change_summary: string | null
  hash_fingerprint: string
  created_at: string
}

export interface Interview {
  id: string
  idea_id: string
  user_id: string
  session_number: number
  interview_mode: InterviewMode
  target_module: ModuleType | null
  depth_score: number | null
  concept_map: ConceptMap
  started_at: string
  ended_at: string | null
}

export interface InterviewMessage {
  id: string
  interview_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent_persona: AgentPersona | null
  flagged_as_insight: boolean
  token_count: number | null
  created_at: string
}

export interface Module<T extends ModuleContentJson = ModuleContentJson> {
  id: string
  idea_id: string
  version_id: string | null
  module_type: ModuleType
  content_json: T
  generation_status: GenerationStatus
  generated_at: string | null
  last_edited_at: string | null
  edit_source: EditSource | null
  confidence_map: Record<string, 'stated' | 'inferred' | 'researched'> | null
  created_at: string
  updated_at: string
}

// ─── Concept Map ───────────────────────────────────────────────────────────────

export interface ConceptMapDimension {
  value: string
  confidence: number  // 0.00–1.00
}

export interface ConceptMap {
  problem_clarity:       ConceptMapDimension
  solution_specificity:  ConceptMapDimension
  customer_definition:   ConceptMapDimension
  revenue_hypothesis:    ConceptMapDimension
  market_awareness:      ConceptMapDimension
  competitive_awareness: ConceptMapDimension
  founder_motivation:    ConceptMapDimension
  execution_readiness:   ConceptMapDimension
  overall_completeness:  number  // mean of above confidence scores
}

// ─── Module Content Shapes ─────────────────────────────────────────────────────

export interface SummaryContent {
  one_liner: string           // ≤ 140 chars
  elevator_pitch: string      // 3–5 sentences
  core_insight: string        // the non-obvious thing this founder sees
  tags: string[]
}

export interface ProblemContent {
  problem_statement: string
  who_has_it: string
  current_solutions: string[]
  why_current_solutions_fail: string
  pain_intensity: 'low' | 'medium' | 'high' | 'critical'
}

export interface SolutionContent {
  solution_description: string
  key_differentiators: string[]
  unfair_advantages: string[]
  technical_complexity: 'low' | 'medium' | 'high'
}

export interface CustomerContent {
  primary_segment: string
  icp_description: string
  jobs_to_be_done: string[]
  persona_signals: string[]
  acquisition_hypothesis: string
}

export interface ScorecardDimension {
  score: number           // 1–10
  explanation: string
  improvement_path: string
}

export interface ScorecardContent {
  clarity:     ScorecardDimension
  market:      ScorecardDimension
  difficulty:  ScorecardDimension
  scalability: ScorecardDimension
  readiness:   ScorecardDimension
  critic_concerns: Array<{
    concern: string
    tied_to_module: ModuleType
  }>
  pivot_mode_triggered: boolean
  generated_from_session: number  // session_number that produced this scorecard
}

export interface RevenueContent {
  model_type: string[]
  pricing_hypothesis: string
  unit_economics: {
    cac_estimate: string
    ltv_estimate: string
    payback_period: string
  }
  revenue_risks: string[]
}

export interface RoadmapCard {
  id: string
  feature: string
  description: string
  user_story: string
  effort: 'S' | 'M' | 'L'
  rationale: string
  dependencies: string[]
  completed: boolean
}

export interface RoadmapContent {
  now: RoadmapCard[]    // Week 1–2
  next: RoadmapCard[]   // Week 3–6
  later: RoadmapCard[]  // Week 7–12
  flavor: 'minimum_viable' | 'minimum_lovable'
}

export interface PitchSlide {
  headline: string
  body: string
  notes: string
  data_available?: boolean  // false → slide flagged as incomplete, never fabricated
  source?: string           // for market slide: citation
}

export interface PitchContent {
  slides: {
    problem:        PitchSlide
    solution:       PitchSlide
    market:         PitchSlide
    business_model: PitchSlide
    traction:       PitchSlide
    team:           PitchSlide
    ask:            PitchSlide
  }
  tone: 'yc_application' | 'demo_day' | 'seed_round' | 'series_a'
}

export interface ActionPlanContent {
  immediate: Array<{ action: string; owner: string; deadline: string }>
  this_week: Array<{ action: string; owner: string; deadline: string }>
  this_month: Array<{ action: string; owner: string; deadline: string }>
  blockers: string[]
}

export interface GrowthStrategyContent {
  primary_channel: string
  channel_rationale: string
  loops: Array<{ name: string; mechanic: string }>
  north_star_metric: string
  milestones: Array<{ milestone: string; timeframe: string }>
}

export interface CompetitiveLandscapeContent {
  competitors: Array<{
    name: string
    description: string
    strengths: string[]
    weaknesses: string[]
    source_url: string
    retrieved_at: string
  }>
  positioning_statement: string
  differentiation_map: Record<string, string>
  research_date: string
}

export interface DiscoverySynthesisContent {
  interviews_conducted: number
  key_findings: string[]
  validated_hypotheses: string[]
  invalidated_hypotheses: string[]
  open_questions: string[]
  recommended_pivots: string[]
}

// ─── Union Type ────────────────────────────────────────────────────────────────

export type ModuleContentJson =
  | SummaryContent
  | ProblemContent
  | SolutionContent
  | CustomerContent
  | ScorecardContent
  | RevenueContent
  | RoadmapContent
  | PitchContent
  | ActionPlanContent
  | GrowthStrategyContent
  | CompetitiveLandscapeContent
  | DiscoverySynthesisContent

// ─── Module Registry ───────────────────────────────────────────────────────────
// Adding a new module: add one entry here. Nothing else changes.

export const MODULE_REGISTRY: Record<ModuleType, {
  label: string
  description: string
  order: number
  unlockedAt: IdeaStage    // earliest stage where this module is available
  requiredForStage: IdeaStage | null  // this module must be complete to advance
}> = {
  summary:               { label: 'Startup Summary',         description: 'One-liner, elevator pitch, core insight', order: 1,  unlockedAt: 'idea',      requiredForStage: 'blueprint'  },
  problem:               { label: 'Problem Statement',        description: 'Who has it, why current solutions fail',  order: 2,  unlockedAt: 'idea',      requiredForStage: 'blueprint'  },
  solution:              { label: 'Solution',                 description: 'What you\'re building and why it wins',   order: 3,  unlockedAt: 'idea',      requiredForStage: 'blueprint'  },
  customer:              { label: 'Customer Profile',         description: 'ICP, jobs to be done, acquisition path', order: 4,  unlockedAt: 'idea',      requiredForStage: 'blueprint'  },
  scorecard:             { label: 'Business Scorecard',       description: 'Five-dimension idea strength rating',     order: 5,  unlockedAt: 'idea',      requiredForStage: null         },
  revenue:               { label: 'Revenue Model',            description: 'Model, pricing, unit economics',          order: 6,  unlockedAt: 'blueprint', requiredForStage: 'prototype'  },
  roadmap:               { label: 'MVP Roadmap',              description: 'Now / Next / Later build plan',           order: 7,  unlockedAt: 'blueprint', requiredForStage: 'prototype'  },
  pitch:                 { label: 'Investor Pitch',           description: '7-slide investor narrative',              order: 8,  unlockedAt: 'blueprint', requiredForStage: null         },
  action_plan:           { label: 'Action Plan',              description: 'Immediate, this week, this month',        order: 9,  unlockedAt: 'blueprint', requiredForStage: null         },
  growth_strategy:       { label: 'Growth Strategy',          description: 'Channels, loops, north star metric',      order: 10, unlockedAt: 'prototype', requiredForStage: null         },
  competitive_landscape: { label: 'Competitive Landscape',    description: 'Competitor map with citations',           order: 11, unlockedAt: 'blueprint', requiredForStage: null         },
  discovery_synthesis:   { label: 'Discovery Synthesis',      description: 'Customer interview findings',             order: 12, unlockedAt: 'prototype', requiredForStage: null         },
}
