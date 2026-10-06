'use client'

// src/components/PivotMode.tsx
// Pivot Mode: split panel.
// Left: current idea scorecard + what's at risk.
// Right: exploration canvas — pre-pivot conversation → three direction cards → mini-interview per branch.
//
// State machine:
//   'conversation'  → short pre-pivot dialogue surfaces founder's actual doubt
//   'directions'    → three AI-generated pivot cards shown
//   'exploring'     → founder opens a mini-interview for one direction
//   'committed'     → pivot committed, workspace refreshes

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { trpc } from '@/lib/trpc/client'
import type { ScorecardContent, ScorecardDimension } from '@/types/modules'

// ─── Types ────────────────────────────────────────────────────────────────────

type PivotStage = 'conversation' | 'directions' | 'exploring' | 'committed'

interface PivotBranch {
  id: string
  retained_component: string
  direction_label: string
  direction_summary: string
  direction_rationale: string
  hypothesis: string
  status: string
  branch_scorecard?: Partial<ScorecardContent>
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface PivotModeProps {
  ideaId: string
  scorecard: ScorecardContent
  ideaTitle: string
  onCommitted: () => void   // called when pivot is committed — workspace refreshes
  onDismiss: () => void     // called when founder returns to original idea
}

// ─── Retained component labels ────────────────────────────────────────────────

const COMPONENT_LABELS: Record<string, string> = {
  technology:       'Core technology',
  customer_segment: 'Customer segment',
  problem_framing:  'Problem framing',
  business_model:   'Business model',
  team_insight:     'Team insight',
}

// ─── Mini score ring ──────────────────────────────────────────────────────────

function MiniRing({ score, label, size = 48 }: { score: number; label: string; size?: number }) {
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const fill = (score / 10) * circ
  const color = score >= 7 ? '#2563EB' : score >= 5 ? '#D97706' : '#DC2626'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2E2C28" strokeWidth="3" />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
          fill="#E8E6E1" fontSize={size * 0.24} fontWeight="600" fontFamily="monospace">
          {score.toFixed(1)}
        </text>
      </svg>
      <span style={{ fontSize: 9, color: '#8A8880', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  )
}

// ─── Pre-pivot Conversation ───────────────────────────────────────────────────

function PivotConversation({
  ideaId,
  scorecard,
  onComplete,
}: {
  ideaId: string
  scorecard: ScorecardContent
  onComplete: (doubt: string) => void
}) {
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turnCount, setTurnCount] = useState(0)
  const [founderDoubt, setFounderDoubt] = useState('')
  const [canProceed, setCanProceed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const startSession = trpc.interviews.startSession.useMutation()

  // Start a pivot pre-conversation session
  useEffect(() => {
    async function init() {
      const session = await startSession.mutateAsync({
        ideaId,
        mode: 'pivot',
      })
      setSessionId(session.sessionId)

      // Seed with the Strategist's opening
      const opening = `Your Market Score is ${scorecard.market.score.toFixed(1)}/10. Before we explore alternatives, I want to understand what you think isn't working. What specifically about the current market framing feels off to you?`
      setMessages([{ role: 'assistant', content: opening }])
    }
    init()
  }, []) // eslint-disable-line

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming || !sessionId) return
    const userText = input.trim()
    setInput('')
    setFounderDoubt(prev => prev ? `${prev} ${userText}` : userText)

    const userMsgId = `u-${Date.now()}`
    const asstMsgId = `a-${Date.now()}`
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userText },
      { role: 'assistant', content: '', streaming: true },
    ])
    setStreaming(true)

    const token = await getToken({ template: 'supabase' })
    let text = ''

    try {
      const res = await fetch('/api/interview/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, userMessage: userText, ideaId }),
      })

      const reader = res.body!.getReader()
      const dec = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.text) {
              text += data.text
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: text } : m
              ))
            }
          } catch {}
        }
      }
    } finally {
      setStreaming(false)
      const newCount = turnCount + 1
      setTurnCount(newCount)
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, streaming: false } : m
      ))
      if (newCount >= 3) setCanProceed(true)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [input, streaming, sessionId, ideaId, turnCount, getToken])

  return (
    <div style={s.convRoot}>
      <div style={s.convMessages}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? s.userMsg : s.asstMsg}>
            {m.content}
            {m.streaming && <span style={s.cursor} />}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {canProceed && (
        <div style={s.proceedOffer}>
          <p style={s.proceedText}>I have enough context. Ready to see three pivot directions?</p>
          <button style={s.proceedBtn} onClick={() => onComplete(founderDoubt)}>
            Show pivot directions →
          </button>
        </div>
      )}

      <div style={s.inputRow}>
        <textarea
          style={s.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="What feels off about the current direction…"
          disabled={streaming}
          rows={2}
        />
        <button style={{ ...s.sendBtn, opacity: streaming || !input.trim() ? 0.4 : 1 }}
          onClick={sendMessage} disabled={streaming || !input.trim()}>→</button>
      </div>
    </div>
  )
}

// ─── Direction Card ───────────────────────────────────────────────────────────

function DirectionCard({
  branch,
  isExploring,
  onExplore,
  onAbandon,
}: {
  branch: PivotBranch
  isExploring: boolean
  onExplore: () => void
  onAbandon: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const componentColor: Record<string, string> = {
    technology:       '#2563EB',
    customer_segment: '#7C3AED',
    problem_framing:  '#059669',
    business_model:   '#D97706',
    team_insight:     '#DC2626',
  }

  const color = componentColor[branch.retained_component] ?? '#2563EB'

  return (
    <div style={{
      ...s.dirCard,
      borderColor: isExploring ? color : '#2E2C28',
      background: isExploring ? 'rgba(37,99,235,0.04)' : '#222018',
    }}>
      <div style={s.dirCardTop}>
        <span style={{ ...s.componentTag, color, borderColor: color }}>
          Retains {COMPONENT_LABELS[branch.retained_component] ?? branch.retained_component}
        </span>
        {branch.status === 'committed' && (
          <span style={s.committedBadge}>Committed</span>
        )}
        {branch.status === 'abandoned' && (
          <span style={s.abandonedBadge}>Abandoned</span>
        )}
      </div>

      <h3 style={s.dirLabel}>{branch.direction_label}</h3>
      <p style={s.dirSummary}>{branch.direction_summary}</p>

      <button style={s.showMoreBtn} onClick={() => setExpanded(e => !e)}>
        {expanded ? 'Less ↑' : 'Hypothesis + rationale ↓'}
      </button>

      {expanded && (
        <div style={s.dirDetail}>
          <p style={s.detailLabel}>Testable hypothesis</p>
          <p style={s.detailValue}>"{branch.hypothesis}"</p>
          <p style={s.detailLabel}>Why retain this component</p>
          <p style={s.detailValue}>{branch.direction_rationale}</p>
        </div>
      )}

      {branch.branch_scorecard && (
        <div style={s.branchScores}>
          {branch.branch_scorecard.market && (
            <MiniRing score={branch.branch_scorecard.market.score} label="Market" size={44} />
          )}
          {branch.branch_scorecard.clarity && (
            <MiniRing score={branch.branch_scorecard.clarity.score} label="Clarity" size={44} />
          )}
        </div>
      )}

      {branch.status === 'proposed' || branch.status === 'exploring' ? (
        <div style={s.dirActions}>
          <button
            style={{ ...s.exploreBtn, background: isExploring ? '#1D4ED8' : '#2563EB' }}
            onClick={onExplore}
          >
            {isExploring ? 'Continue exploring →' : 'Explore this direction →'}
          </button>
          {branch.status === 'proposed' && (
            <button style={s.abandonBtn} onClick={onAbandon}>Abandon</button>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ─── Branch Interview ─────────────────────────────────────────────────────────

function BranchInterview({
  branch,
  ideaId,
  onCommit,
  onBack,
}: {
  branch: PivotBranch
  ideaId: string
  onCommit: (branchId: string, sessionId: string) => void
  onBack: () => void
}) {
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [canCommit, setCanCommit] = useState(false)
  const [turnCount, setTurnCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const startExploration = trpc.pivot.startExploration.useMutation()

  useEffect(() => {
    async function init() {
      const result = await startExploration.mutateAsync({ branchId: branch.id })
      setSessionId(result.sessionId)
      setMessages([{
        role: 'assistant',
        content: `Let's explore: ${branch.direction_label}.\n\nWhat initially drew you to this direction specifically?`,
      }])
    }
    init()
  }, []) // eslint-disable-line

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming || !sessionId) return
    const userText = input.trim()
    setInput('')
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userText },
      { role: 'assistant', content: '', streaming: true },
    ])
    setStreaming(true)

    const token = await getToken({ template: 'supabase' })
    let text = ''

    try {
      const res = await fetch('/api/interview/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, userMessage: userText, ideaId }),
      })

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.text) {
              text += data.text
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: text } : m
              ))
            }
          } catch {}
        }
      }
    } finally {
      setStreaming(false)
      const newCount = turnCount + 1
      setTurnCount(newCount)
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, streaming: false } : m
      ))
      if (newCount >= 4) setCanCommit(true)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [input, streaming, sessionId, ideaId, turnCount, getToken])

  return (
    <div style={s.branchRoot}>
      <div style={s.branchHeader}>
        <button style={s.backBtn} onClick={onBack}>← All directions</button>
        <span style={s.branchTitle}>{branch.direction_label}</span>
      </div>

      <div style={s.convMessages}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? s.userMsg : s.asstMsg}>
            {m.content}
            {m.streaming && <span style={s.cursor} />}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {canCommit && sessionId && (
        <div style={s.commitOffer}>
          <p style={s.commitText}>
            Ready to commit to this direction? This will replace your current modules
            with new outputs generated from this exploration. Your original idea is preserved.
          </p>
          <button style={s.commitBtn} onClick={() => onCommit(branch.id, sessionId)}>
            Commit to this pivot →
          </button>
        </div>
      )}

      <div style={s.inputRow}>
        <textarea
          style={s.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Explore this direction…"
          disabled={streaming}
          rows={2}
        />
        <button style={{ ...s.sendBtn, opacity: streaming || !input.trim() ? 0.4 : 1 }}
          onClick={sendMessage} disabled={streaming || !input.trim()}>→</button>
      </div>
    </div>
  )
}

// ─── Main PivotMode Component ─────────────────────────────────────────────────

export default function PivotMode({
  ideaId,
  scorecard,
  ideaTitle,
  onCommitted,
  onDismiss,
}: PivotModeProps) {
  const [stage, setStage] = useState<PivotStage>('conversation')
  const [branches, setBranches] = useState<PivotBranch[]>([])
  const [exploringBranchId, setExploringBranchId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const generateDirections = trpc.pivot.generateDirections.useMutation()
  const commitPivot = trpc.pivot.commitPivot.useMutation()
  const abandonBranch = trpc.pivot.abandonBranch.useMutation()
  const endSession = trpc.interviews.endSession.useMutation()
  const utils = trpc.useUtils()

  const dims: Array<[string, keyof ScorecardContent]> = [
    ['Clarity', 'clarity'], ['Market', 'market'],
    ['Difficulty', 'difficulty'], ['Scalability', 'scalability'], ['Readiness', 'readiness'],
  ]

  async function handleConversationComplete(founderDoubt: string) {
    setGenerating(true)
    try {
      const result = await generateDirections.mutateAsync({ ideaId, founderDoubt })
      setBranches(result.branches as PivotBranch[])
      setStage('directions')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCommit(branchId: string, sessionId: string) {
    // End the exploration session first (triggers post-session pipeline)
    await endSession.mutateAsync({ sessionId })
    await commitPivot.mutateAsync({ branchId, sessionId })
    await utils.ideas.get.invalidate({ ideaId })
    setStage('committed')
    onCommitted()
  }

  async function handleAbandon(branchId: string) {
    await abandonBranch.mutateAsync({ branchId })
    setBranches(prev =>
      prev.map(b => b.id === branchId ? { ...b, status: 'abandoned' } : b)
    )
  }

  const exploringBranch = branches.find(b => b.id === exploringBranchId)

  return (
    <div style={s.root}>
      {/* ── Left panel: current state ── */}
      <div style={s.leftPanel}>
        <div style={s.leftHeader}>
          <span style={s.pivotLabel}>Pivot Mode</span>
          <button style={s.dismissBtn} onClick={onDismiss}>Return to original →</button>
        </div>

        <p style={s.ideaTitleLeft}>{ideaTitle}</p>

        <div style={s.scorecardLeft}>
          <p style={s.sectionLabel}>Current scorecard</p>
          <div style={s.ringsRow}>
            {dims.map(([label, key]) => {
              const dim = scorecard[key] as ScorecardDimension | undefined
              return dim ? <MiniRing key={key} score={dim.score} label={label} /> : null
            })}
          </div>

          <div style={s.marketExplain}>
            <p style={s.sectionLabel}>Market — why it's low</p>
            <p style={s.explainText}>{scorecard.market.explanation}</p>
          </div>

          {scorecard.critic_concerns.length > 0 && (
            <div style={s.concerns}>
              <p style={s.sectionLabel}>Open questions</p>
              {scorecard.critic_concerns.map((c, i) => (
                <div key={i} style={s.concernItem}>
                  <span style={s.concernTag}>{c.tied_to_module}</span>
                  <p style={s.concernText}>{c.concern}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.preservationNote}>
          <span style={s.lockIcon}>⚿</span>
          <p style={s.preservationText}>
            Original idea is preserved. A pivot creates a branch — nothing is deleted.
          </p>
        </div>
      </div>

      {/* ── Right panel: exploration canvas ── */}
      <div style={s.rightPanel}>
        {generating && (
          <div style={s.generatingState}>
            <div style={s.generatingLine} />
            <p style={s.generatingText}>Generating pivot directions…</p>
          </div>
        )}

        {!generating && stage === 'conversation' && (
          <div style={s.stageWrap}>
            <p style={s.stageLabel}>Step 1 of 2 — Diagnose</p>
            <p style={s.stageDesc}>
              A short conversation to surface what you think isn't working before exploring alternatives.
            </p>
            <PivotConversation
              ideaId={ideaId}
              scorecard={scorecard}
              onComplete={handleConversationComplete}
            />
          </div>
        )}

        {!generating && stage === 'directions' && !exploringBranchId && (
          <div style={s.stageWrap}>
            <p style={s.stageLabel}>Step 2 of 2 — Explore</p>
            <p style={s.stageDesc}>
              Three directions, each built from a different component worth keeping.
              Open one to start a focused exploration interview.
            </p>
            <div style={s.directionsStack}>
              {branches.map(branch => (
                <DirectionCard
                  key={branch.id}
                  branch={branch}
                  isExploring={branch.id === exploringBranchId}
                  onExplore={() => {
                    setExploringBranchId(branch.id)
                    setStage('exploring')
                  }}
                  onAbandon={() => handleAbandon(branch.id)}
                />
              ))}
            </div>
          </div>
        )}

        {!generating && stage === 'exploring' && exploringBranch && (
          <BranchInterview
            branch={exploringBranch}
            ideaId={ideaId}
            onCommit={handleCommit}
            onBack={() => {
              setExploringBranchId(null)
              setStage('directions')
            }}
          />
        )}

        {stage === 'committed' && (
          <div style={s.committedState}>
            <div style={s.committedIcon}>◆</div>
            <p style={s.committedTitle}>Pivot committed.</p>
            <p style={s.committedSub}>
              New modules are being generated from your exploration. Your workspace will update shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    background: '#1A1814',
    fontFamily: 'ui-monospace, monospace',
    color: '#E8E6E1',
  },

  // Left panel
  leftPanel: {
    width: 300,
    minWidth: 300,
    borderRight: '1px solid #2E2C28',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 20px',
    gap: 20,
    overflowY: 'auto',
  },
  leftHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pivotLabel: {
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#DC2626',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#8A8880',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
    letterSpacing: '0.04em',
  },
  ideaTitleLeft: {
    fontFamily: 'Georgia, serif',
    fontSize: 16,
    color: '#E8E6E1',
    lineHeight: 1.4,
    paddingBottom: 16,
    borderBottom: '1px solid #2E2C28',
  },
  scorecardLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#8A8880',
    marginBottom: 8,
  },
  ringsRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  marketExplain: {
    paddingTop: 4,
  },
  explainText: {
    fontSize: 12,
    color: '#8A8880',
    lineHeight: 1.6,
  },
  concerns: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  concernItem: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  concernTag: {
    fontSize: 9,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#8A8880',
    padding: '2px 6px',
    background: '#2A2820',
    borderRadius: 2,
    flexShrink: 0,
    marginTop: 2,
  },
  concernText: {
    fontSize: 12,
    color: '#8A8880',
    lineHeight: 1.5,
  },
  preservationNote: {
    marginTop: 'auto',
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    padding: '12px 14px',
    background: 'rgba(37,99,235,0.06)',
    borderLeft: '2px solid #2563EB',
    borderRadius: 2,
  },
  lockIcon: {
    fontSize: 14,
    color: '#2563EB',
    flexShrink: 0,
    marginTop: 1,
  },
  preservationText: {
    fontSize: 11,
    color: '#8A8880',
    lineHeight: 1.5,
  },

  // Right panel
  rightPanel: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  stageWrap: {
    padding: '32px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
  },
  stageLabel: {
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#8A8880',
  },
  stageDesc: {
    fontSize: 13,
    color: '#8A8880',
    lineHeight: 1.6,
    maxWidth: 480,
    marginBottom: 24,
  },

  // Conversation
  convRoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    flex: 1,
  },
  convMessages: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflowY: 'auto',
    paddingBottom: 16,
    maxHeight: '50vh',
  },
  userMsg: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    background: '#2A2820',
    border: '1px solid #2E2C28',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 13,
    lineHeight: 1.6,
    color: '#E8E6E1',
  },
  asstMsg: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    fontSize: 14,
    lineHeight: 1.65,
    color: '#E8E6E1',
    fontFamily: 'Georgia, serif',
  },
  cursor: {
    display: 'inline-block',
    width: 2,
    height: '1em',
    background: '#2563EB',
    marginLeft: 2,
    verticalAlign: 'text-bottom',
    animation: 'blink 1s step-end infinite',
  },
  proceedOffer: {
    marginTop: 16,
    padding: '14px 16px',
    background: 'rgba(37,99,235,0.07)',
    border: '1px solid rgba(37,99,235,0.25)',
    borderRadius: 5,
  },
  proceedText: {
    fontSize: 12,
    color: '#8A8880',
    marginBottom: 10,
    lineHeight: 1.5,
  },
  proceedBtn: {
    width: '100%',
    padding: '9px 0',
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    background: '#1A1814',
    border: '1px solid #2E2C28',
    borderRadius: 5,
    color: '#E8E6E1',
    fontSize: 13,
    lineHeight: 1.6,
    padding: '10px 12px',
    resize: 'none',
    outline: 'none',
    fontFamily: 'Georgia, serif',
  },
  sendBtn: {
    padding: '0 16px',
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 16,
    cursor: 'pointer',
    alignSelf: 'stretch',
    minHeight: 60,
    transition: 'opacity 0.15s',
  },

  // Direction cards
  directionsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxWidth: 580,
  },
  dirCard: {
    padding: '20px 22px',
    background: '#222018',
    border: '1px solid #2E2C28',
    borderRadius: 7,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: 'border-color 0.2s, background 0.2s',
  },
  dirCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  componentTag: {
    fontSize: 9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    border: '1px solid',
    borderRadius: 3,
  },
  committedBadge: {
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#059669',
    padding: '2px 8px',
    background: 'rgba(5,150,105,0.1)',
    borderRadius: 2,
  },
  abandonedBadge: {
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#4B4840',
    padding: '2px 8px',
    background: '#2A2820',
    borderRadius: 2,
  },
  dirLabel: {
    fontFamily: 'Georgia, serif',
    fontSize: 17,
    fontWeight: 'normal',
    color: '#E8E6E1',
    lineHeight: 1.3,
  },
  dirSummary: {
    fontSize: 13,
    color: '#8A8880',
    lineHeight: 1.6,
  },
  showMoreBtn: {
    background: 'none',
    border: 'none',
    color: '#4B4840',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
    letterSpacing: '0.04em',
    textAlign: 'left',
  },
  dirDetail: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 0 4px',
    borderTop: '1px solid #2E2C28',
  },
  detailLabel: {
    fontSize: 9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#8A8880',
  },
  detailValue: {
    fontSize: 13,
    color: '#E8E6E1',
    lineHeight: 1.6,
    fontStyle: 'italic',
    fontFamily: 'Georgia, serif',
  },
  branchScores: {
    display: 'flex',
    gap: 16,
    paddingTop: 4,
  },
  dirActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    paddingTop: 4,
  },
  exploreBtn: {
    padding: '8px 16px',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'background 0.15s',
  },
  abandonBtn: {
    background: 'none',
    border: 'none',
    color: '#4B4840',
    fontSize: 11,
    cursor: 'pointer',
    padding: '8px 4px',
    letterSpacing: '0.04em',
  },

  // Branch interview
  branchRoot: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: '24px 40px',
    gap: 16,
  },
  branchHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 16,
    borderBottom: '1px solid #2E2C28',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#8A8880',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  branchTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: 15,
    color: '#E8E6E1',
    lineHeight: 1.3,
  },
  commitOffer: {
    padding: '14px 16px',
    background: 'rgba(5,150,105,0.07)',
    border: '1px solid rgba(5,150,105,0.3)',
    borderRadius: 5,
  },
  commitText: {
    fontSize: 12,
    color: '#8A8880',
    lineHeight: 1.6,
    marginBottom: 10,
  },
  commitBtn: {
    width: '100%',
    padding: '10px 0',
    background: '#059669',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },

  // Generating / committed states
  generatingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 16,
  },
  generatingLine: {
    height: 1,
    width: 80,
    background: '#2563EB',
    animation: 'shimmer 1.2s ease infinite',
  },
  generatingText: {
    fontSize: 12,
    color: '#8A8880',
    letterSpacing: '0.06em',
  },
  committedState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 16,
    padding: 40,
  },
  committedIcon: {
    fontSize: 32,
    color: '#059669',
  },
  committedTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: 22,
    color: '#E8E6E1',
  },
  committedSub: {
    fontSize: 13,
    color: '#8A8880',
    lineHeight: 1.6,
    textAlign: 'center',
    maxWidth: 360,
  },
}
