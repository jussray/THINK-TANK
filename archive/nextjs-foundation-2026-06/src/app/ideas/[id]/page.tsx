'use client'

// src/app/ideas/[id]/page.tsx
// The main workspace page. Handles:
//   - First-session auto-start (when navigating from onboarding with ?firstMessage=)
//   - Live interview panel
//   - Module generation status polling
//   - Full workspace UI

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { trpc } from '@/lib/trpc/client'
import { useInterview } from '@/hooks/useInterview'
import { useModulePolling } from '@/hooks/useModulePolling'
import IdeaWorkspace from '@/components/IdeaWorkspace'
import PivotMode from '@/components/PivotMode'
import type { ModuleType, InterviewMode } from '@/types/modules'

export default function IdeaPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { userId } = useAuth()

  const ideaId = params.id as string
  const firstMessage = searchParams.get('firstMessage')
  const founderMode = (searchParams.get('mode') ?? 'dreamer') as InterviewMode

  const [showInterview, setShowInterview] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showPivotMode, setShowPivotMode] = useState(false)
  const firstMessageSent = useRef(false)

  // Load idea + all modules
  const { data: idea, isLoading } = trpc.ideas.get.useQuery(
    { ideaId },
    { enabled: !!ideaId }
  )

  const { state: interviewState, startSession, sendMessage, endSession } = useInterview(ideaId)

  // Poll module status while generating
  const { anyGenerating, allComplete } = useModulePolling(
    ideaId,
    interviewState.generating || interviewState.sessionEnded
  )

  // Auto-start interview on first visit from onboarding
  useEffect(() => {
    if (!firstMessage || firstMessageSent.current || !ideaId) return
    firstMessageSent.current = true

    async function kickoff() {
      setShowInterview(true)
      const sessionId = await startSession('initial')
      setActiveSessionId(sessionId)
      // Send their first message immediately — no waiting
      await sendMessage(sessionId, firstMessage!)
    }

    kickoff()
  }, [firstMessage, ideaId]) // eslint-disable-line

  async function handleStartInterview(mode: string = 'initial', targetModule?: ModuleType) {
    setShowInterview(true)
    const sessionId = await startSession(mode as InterviewMode, targetModule)
    setActiveSessionId(sessionId)
  }

  async function handleEndSession() {
    if (!activeSessionId) return
    await endSession(activeSessionId)
    setShowInterview(false)
    setActiveSessionId(null)
  }

  if (isLoading || !idea) {
    return <LoadingShell />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#1A1814' }}>
      {/* Workspace */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <IdeaWorkspace
          idea={idea as any}
          userId={userId ?? ''}
          onStartInterview={handleStartInterview}
          onPivotMode={() => setShowPivotMode(true)}
        />
      </div>

      {/* Interview panel — slides in from right */}
      {showInterview && activeSessionId && (
        <InterviewPanelFull
          ideaId={ideaId}
          sessionId={activeSessionId}
          interviewState={interviewState}
          onSend={(msg) => sendMessage(activeSessionId, msg)}
          onEnd={handleEndSession}
        />
      )}

      {/* Pivot Mode fullscreen */}
      {showPivotMode && (() => {
        const scorecardModule = (idea as any).modules?.find((m: any) => m.module_type === 'scorecard')
        const scorecard = scorecardModule?.content_json
        return scorecard ? (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#1A1814' }}>
            <PivotMode
              ideaId={ideaId}
              scorecard={scorecard}
              ideaTitle={(idea as any).title}
              onCommitted={() => {
                setShowPivotMode(false)
              }}
              onDismiss={() => setShowPivotMode(false)}
            />
          </div>
        ) : null
      })()}

      {/* Generation overlay — shown while post-session pipeline runs */}
      {interviewState.generating && <GeneratingOverlay />}
    </div>
  )
}

// ─── Interview Panel (full, connected to useInterview) ────────────────────────

function InterviewPanelFull({
  ideaId,
  sessionId,
  interviewState,
  onSend,
  onEnd,
}: {
  ideaId: string
  sessionId: string
  interviewState: ReturnType<typeof useInterview>['state']
  onSend: (msg: string) => void
  onEnd: () => void
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [interviewState.messages.length, interviewState.streaming])

  function handleSend() {
    if (!input.trim() || interviewState.streaming) return
    onSend(input.trim())
    setInput('')
  }

  const depthPct = interviewState.completeness
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0]

  return (
    <div style={panelStyles.root}>
      {/* Header */}
      <div style={panelStyles.header}>
        <div style={panelStyles.headerLeft}>
          <span style={panelStyles.sessionLabel}>Interview</span>
          <div style={panelStyles.depthRings}>
            {rings.map((t, i) => (
              <span
                key={i}
                style={{
                  ...panelStyles.ring,
                  background: depthPct >= t ? '#2563EB' : '#2E2C28',
                }}
              />
            ))}
          </div>
          <span style={panelStyles.depthPct}>
            {(depthPct * 100).toFixed(0)}%
          </span>
        </div>
        <button style={panelStyles.closeBtn} onClick={onEnd}>
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={panelStyles.messages}>
        {interviewState.messages.length === 0 && (
          <div style={panelStyles.emptyMessages}>
            <ThinkingLine />
          </div>
        )}
        {interviewState.messages.map(msg => (
          <div
            key={msg.id}
            style={{
              ...panelStyles.message,
              ...(msg.role === 'user' ? panelStyles.userMessage : panelStyles.assistantMessage),
            }}
          >
            {msg.content}
            {msg.streaming && <ThinkingCursor />}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* End session offer */}
      {interviewState.readyToEnd && !interviewState.sessionEnded && (
        <div style={panelStyles.endOffer}>
          <p style={panelStyles.endOfferText}>
            I have enough to generate your first outputs.
          </p>
          <button style={panelStyles.endBtn} onClick={onEnd}>
            Generate outputs →
          </button>
        </div>
      )}

      {/* Error */}
      {interviewState.error && (
        <div style={panelStyles.errorBanner}>
          {interviewState.error}
        </div>
      )}

      {/* Input */}
      <div style={panelStyles.inputRow}>
        <textarea
          style={panelStyles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Respond…"
          disabled={interviewState.streaming || interviewState.sessionEnded}
          rows={3}
        />
        <button
          style={{
            ...panelStyles.sendBtn,
            opacity: interviewState.streaming || !input.trim() ? 0.4 : 1,
          }}
          onClick={handleSend}
          disabled={interviewState.streaming || !input.trim()}
        >
          →
        </button>
      </div>
    </div>
  )
}

// ─── Thinking indicators ──────────────────────────────────────────────────────

function ThinkingLine() {
  return (
    <div style={{
      height: 1,
      width: 48,
      background: '#2563EB',
      animation: 'shimmer 1.4s ease infinite',
      margin: '24px 0',
    }} />
  )
}

function ThinkingCursor() {
  return (
    <span style={{
      display: 'inline-block',
      width: 2,
      height: '1em',
      background: '#2563EB',
      marginLeft: 2,
      verticalAlign: 'text-bottom',
      animation: 'blink 1s step-end infinite',
    }} />
  )
}

// ─── Generating overlay ───────────────────────────────────────────────────────

function GeneratingOverlay() {
  const steps = ['Synthesizing modules', 'Running critic', 'Scoring', 'Updating memory']
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % steps.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(26, 24, 20, 0.85)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      backdropFilter: 'blur(4px)',
      zIndex: 50,
    }}>
      <div style={{
        height: 1, width: 80,
        background: '#2563EB',
        animation: 'shimmer 1s ease infinite',
      }} />
      <p style={{
        fontSize: 13,
        color: '#8A8880',
        letterSpacing: '0.06em',
        fontFamily: 'ui-monospace, monospace',
        animation: 'fadeUp 0.3s ease-out both',
        key: step,
      }}>
        {steps[step]}…
      </p>
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── Loading shell ────────────────────────────────────────────────────────────

function LoadingShell() {
  return (
    <div style={{
      height: '100vh',
      background: '#1A1814',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ height: 1, width: 60, background: '#2563EB', animation: 'shimmer 1s ease infinite' }} />
      <style>{`@keyframes shimmer { 0%,100% { opacity:0.4; } 50% { opacity:1; } }`}</style>
    </div>
  )
}

// ─── Panel styles ─────────────────────────────────────────────────────────────

const panelStyles: Record<string, React.CSSProperties> = {
  root: {
    width: 380,
    minWidth: 380,
    height: '100vh',
    borderLeft: '1px solid #2E2C28',
    background: '#222018',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'ui-monospace, monospace',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid #2E2C28',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  sessionLabel: {
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#8A8880',
  },
  depthRings: {
    display: 'flex',
    gap: 4,
  },
  ring: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'background 0.4s ease',
  },
  depthPct: {
    fontSize: 11,
    color: '#4B4840',
    fontFamily: 'ui-monospace, monospace',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#4B4840',
    fontSize: 14,
    cursor: 'pointer',
    padding: '4px 6px',
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  emptyMessages: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 80,
  },
  message: {
    fontSize: 13,
    lineHeight: 1.65,
    maxWidth: '92%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    background: '#2A2820',
    border: '1px solid #2E2C28',
    borderRadius: 6,
    padding: '10px 14px',
    color: '#E8E6E1',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    color: '#E8E6E1',
    paddingLeft: 0,
    fontFamily: 'Georgia, serif',
    fontSize: 14,
  },
  endOffer: {
    margin: '0 16px 12px',
    padding: '14px 16px',
    background: 'rgba(37, 99, 235, 0.07)',
    border: '1px solid rgba(37, 99, 235, 0.25)',
    borderRadius: 5,
  },
  endOfferText: {
    fontSize: 12,
    color: '#8A8880',
    marginBottom: 10,
    lineHeight: 1.5,
  },
  endBtn: {
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
  errorBanner: {
    margin: '0 16px 12px',
    padding: '10px 14px',
    background: 'rgba(220, 38, 38, 0.08)',
    border: '1px solid rgba(220, 38, 38, 0.3)',
    borderRadius: 4,
    fontSize: 12,
    color: '#DC2626',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: 16,
    borderTop: '1px solid #2E2C28',
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
    transition: 'border-color 0.15s',
  },
  sendBtn: {
    padding: '0 18px',
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 18,
    cursor: 'pointer',
    alignSelf: 'stretch',
    transition: 'opacity 0.15s',
    minHeight: 72,
  },
}
