// src/components/IdeaWorkspace.tsx
// The Idea Workspace: persistent hub for all modules, versions, and sessions.
// Design language: deep ink, warm cream type, signal blue accent, editorial slow reveals.
// Module cards handle all generation states — pending, generating, complete, error, draft.

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Idea, Module, ModuleType, GenerationStatus, ScorecardContent } from '@/types/modules'
import { MODULE_REGISTRY } from '@/types/modules'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceProps {
  idea: Idea & { modules: Module[] }
  userId: string
  onStartInterview: (mode?: string, targetModule?: ModuleType) => void
  onPivotMode: () => void
}

// ─── Scorecard Ring Component ─────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: string }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const filled = (score / 10) * circumference
  const color = score >= 7 ? '#2563EB' : score >= 5 ? '#D97706' : '#DC2626'

  return (
    <div className="score-ring-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#2E2C28" strokeWidth="4" />
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="36" y="36" textAnchor="middle" dominantBaseline="middle"
          fill="#E8E6E1" fontSize="16" fontWeight="600" fontFamily="monospace">
          {score.toFixed(1)}
        </text>
      </svg>
      <span className="ring-label">{label}</span>
    </div>
  )
}

// ─── Module Card Component ────────────────────────────────────────────────────

function ModuleCard({
  module,
  isSelected,
  onClick,
}: {
  module: Module
  isSelected: boolean
  onClick: () => void
}) {
  const config = MODULE_REGISTRY[module.module_type as ModuleType]
  const statusDot: Record<GenerationStatus, string> = {
    pending:    '#4B4840',
    generating: '#D97706',
    complete:   '#2563EB',
    error:      '#DC2626',
    draft:      '#6B7280',
  }

  return (
    <button
      onClick={onClick}
      className={`module-nav-item ${isSelected ? 'selected' : ''} status-${module.generation_status}`}
    >
      <span className="status-dot" style={{ background: statusDot[module.generation_status] }} />
      <span className="module-label">{config?.label ?? module.module_type}</span>
      {module.generation_status === 'generating' && (
        <span className="generating-pulse" />
      )}
    </button>
  )
}

// ─── Module Content Viewer ────────────────────────────────────────────────────

function ModuleViewer({
  module,
  onRefine,
  onPivotMode,
}: {
  module: Module
  onRefine: (moduleType: ModuleType) => void
  onPivotMode: () => void
}) {
  const config = MODULE_REGISTRY[module.module_type as ModuleType]

  if (module.generation_status === 'pending') {
    return (
      <div className="module-empty-state">
        <p className="empty-label">Not yet generated</p>
        <p className="empty-sub">Complete an interview session to unlock this module.</p>
      </div>
    )
  }

  if (module.generation_status === 'generating') {
    return (
      <div className="module-generating-state">
        <div className="generating-line" />
        <p className="generating-label">Generating {config?.label ?? module.module_type}…</p>
      </div>
    )
  }

  if (module.generation_status === 'error') {
    return (
      <div className="module-error-state">
        <p className="error-label">Generation failed</p>
        <p className="error-sub">The AI returned an error for this module. Start a new session to retry.</p>
      </div>
    )
  }

  if (module.generation_status === 'draft') {
    return (
      <div className="module-draft-state">
        <p className="draft-badge">Draft — Review Recommended</p>
        <ModuleContentRenderer module={module} onPivotMode={onPivotMode} />
        <button className="refine-btn" onClick={() => onRefine(module.module_type as ModuleType)}>
          Refine with AI
        </button>
      </div>
    )
  }

  // Complete
  return (
    <div className="module-content">
      <div className="module-header">
        <h2 className="module-title">{config?.label}</h2>
        <button className="refine-btn" onClick={() => onRefine(module.module_type as ModuleType)}>
          Refine with AI
        </button>
      </div>
      {module.confidence_map && (
        <div className="confidence-banner">
          {Object.entries(module.confidence_map)
            .filter(([, v]) => v === 'inferred')
            .length > 0 && (
            <span className="inferred-note">
              ⚑ Some fields marked as inferred — verify in next session
            </span>
          )}
        </div>
      )}
      <ModuleContentRenderer module={module} onPivotMode={onPivotMode} />
    </div>
  )
}

// ─── Per-module content renderers ─────────────────────────────────────────────

function ModuleContentRenderer({ module, onPivotMode }: { module: Module; onPivotMode: () => void }) {
  const content = module.content_json as Record<string, unknown>

  switch (module.module_type) {
    case 'summary':
      return (
        <div className="module-body">
          <p className="one-liner">"{content.one_liner as string}"</p>
          <p className="field-label">Elevator Pitch</p>
          <p className="field-value">{content.elevator_pitch as string}</p>
          <p className="field-label">Core Insight</p>
          <p className="field-value">{content.core_insight as string}</p>
          {(content.tags as string[])?.length > 0 && (
            <div className="tag-row">
              {(content.tags as string[]).map(t => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          )}
        </div>
      )

    case 'problem':
      return (
        <div className="module-body">
          <p className="field-label">Problem</p>
          <p className="field-value">{content.problem_statement as string}</p>
          <p className="field-label">Who has it</p>
          <p className="field-value">{content.who_has_it as string}</p>
          <p className="field-label">Why current solutions fail</p>
          <p className="field-value">{content.why_current_solutions_fail as string}</p>
          <div className="pain-badge" data-level={content.pain_intensity as string}>
            Pain intensity: {content.pain_intensity as string}
          </div>
        </div>
      )

    case 'solution':
      return (
        <div className="module-body">
          <p className="field-value">{content.solution_description as string}</p>
          {(content.key_differentiators as string[])?.length > 0 && (
            <>
              <p className="field-label">Key differentiators</p>
              <ul className="field-list">
                {(content.key_differentiators as string[]).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </>
          )}
          {(content.unfair_advantages as string[])?.length > 0 && (
            <>
              <p className="field-label">Unfair advantages</p>
              <ul className="field-list">
                {(content.unfair_advantages as string[]).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )

    case 'customer':
      return (
        <div className="module-body">
          <p className="field-label">Primary segment</p>
          <p className="field-value">{content.primary_segment as string}</p>
          <p className="field-label">ICP</p>
          <p className="field-value">{content.icp_description as string}</p>
          <p className="field-label">Acquisition hypothesis</p>
          <p className="field-value">{content.acquisition_hypothesis as string}</p>
        </div>
      )

    case 'scorecard': {
      const sc = content as unknown as ScorecardContent
      const dims: Array<[string, keyof ScorecardContent]> = [
        ['Clarity', 'clarity'], ['Market', 'market'], ['Difficulty', 'difficulty'],
        ['Scalability', 'scalability'], ['Readiness', 'readiness'],
      ]
      return (
        <div className="module-body">
          <div className="score-rings-row">
            {dims.map(([label, key]) => {
              const dim = sc[key] as { score: number; explanation: string; improvement_path: string }
              return dim ? <ScoreRing key={key} score={dim.score} label={label} /> : null
            })}
          </div>
          {sc.critic_concerns?.length > 0 && (
            <div className="critic-concerns">
              <p className="field-label">Open Questions</p>
              {sc.critic_concerns.map((c, i) => (
                <div key={i} className="concern-item">
                  <span className="concern-tag">{c.tied_to_module}</span>
                  <p className="concern-text">{c.concern}</p>
                </div>
              ))}
            </div>
          )}
          {sc.pivot_mode_triggered && (
            <div className="pivot-offer">
              Market score is below 4.{' '}
              <button className="pivot-link" onClick={onPivotMode}>
                Explore Pivot Mode →
              </button>
            </div>
          )}
        </div>
      )
    }

    default:
      return (
        <div className="module-body">
          <pre className="raw-json">{JSON.stringify(content, null, 2)}</pre>
        </div>
      )
  }
}

// ─── Interview Chat Panel ─────────────────────────────────────────────────────

function InterviewPanel({
  ideaId,
  sessionId,
  onSessionEnd,
  authToken,
}: {
  ideaId: string
  sessionId: string
  onSessionEnd: () => void
  authToken: string
}) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [readyToEnd, setReadyToEnd] = useState(false)
  const [completeness, setCompleteness] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setStreaming(true)

    let assistantText = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/interview/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ sessionId, userMessage: userMsg, ideaId }),
      })

      const reader = res.body!.getReader()
      const dec = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = dec.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.text) {
            assistantText += data.text
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: assistantText }
              return updated
            })
          }

          if (data.done) {
            setReadyToEnd(data.readyToEnd)
            setCompleteness(data.completeness)
          }
        }
      }
    } catch (err) {
      console.error('[InterviewPanel] Stream error:', err)
    } finally {
      setStreaming(false)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [input, streaming, sessionId, ideaId, authToken])

  return (
    <div className="interview-panel">
      <div className="interview-header">
        <span className="depth-label">
          Session depth: {(completeness * 100).toFixed(0)}%
        </span>
        <div className="depth-rings">
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, i) => (
            <span
              key={i}
              className={`depth-ring ${completeness >= threshold ? 'filled' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="messages-list">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <p>{msg.content}</p>
          </div>
        ))}
        {streaming && (
          <div className="thinking-indicator">
            <div className="thinking-line" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {readyToEnd && (
        <div className="end-session-offer">
          <p>I have enough to generate your first outputs. End session and generate?</p>
          <button className="end-session-btn" onClick={onSessionEnd}>
            Generate outputs →
          </button>
        </div>
      )}

      <div className="input-row">
        <textarea
          className="message-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
          placeholder="Respond…"
          disabled={streaming}
          rows={3}
        />
        <button
          className={`send-btn ${streaming ? 'disabled' : ''}`}
          onClick={sendMessage}
          disabled={streaming}
        >
          {streaming ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Workspace Component ─────────────────────────────────────────────────

export default function IdeaWorkspace({ idea, userId, onStartInterview, onPivotMode }: WorkspaceProps) {
  const [selectedModule, setSelectedModule] = useState<ModuleType>('summary')
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [showInterview, setShowInterview] = useState(false)

  const moduleMap = Object.fromEntries(
    idea.modules.map(m => [m.module_type, m])
  ) as Record<ModuleType, Module>

  const orderedModules = Object.entries(MODULE_REGISTRY)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([type]) => moduleMap[type as ModuleType])
    .filter(Boolean)

  const handleRefine = (moduleType: ModuleType) => {
    onStartInterview('module_refine', moduleType)
  }

  const stageBadgeColors: Record<string, string> = {
    idea: '#4B4840', blueprint: '#2563EB', prototype: '#7C3AED',
    beta: '#D97706', revenue: '#059669', growth: '#DC2626',
  }

  return (
    <div className="workspace-root">
      <style>{`
        :root {
          --ink: #1A1814;
          --surface: #222018;
          --surface-raised: #2A2820;
          --accent: #2563EB;
          --accent-dim: #1D4ED8;
          --text: #E8E6E1;
          --text-muted: #8A8880;
          --border: #2E2C28;
          --error: #DC2626;
          --warn: #D97706;
          --success: #059669;
          --font-display: 'Georgia', serif;
          --font-ui: 'ui-monospace', 'Menlo', monospace;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .workspace-root {
          display: flex;
          height: 100vh;
          background: var(--ink);
          color: var(--text);
          font-family: var(--font-ui);
          font-size: 13px;
          overflow: hidden;
        }

        /* ── Sidebar ──────────────────────────────── */
        .workspace-sidebar {
          width: 220px;
          min-width: 220px;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 24px 0;
          gap: 0;
          overflow-y: auto;
        }

        .idea-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: normal;
          color: var(--text);
          padding: 0 20px 20px;
          border-bottom: 1px solid var(--border);
          line-height: 1.4;
        }

        .stage-badge {
          display: inline-block;
          margin-top: 8px;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: var(--surface-raised);
          color: var(--text-muted);
        }

        .sidebar-section-label {
          padding: 16px 20px 8px;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .module-nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-ui);
          font-size: 12px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: color 0.15s, background 0.15s;
        }

        .module-nav-item:hover { color: var(--text); background: var(--surface); }
        .module-nav-item.selected { color: var(--text); background: var(--surface-raised); }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .module-label { flex: 1; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .generating-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--warn);
          animation: pulse 1.2s ease infinite;
        }

        .sidebar-actions {
          margin-top: auto;
          padding: 20px;
          border-top: 1px solid var(--border);
        }

        .start-session-btn {
          width: 100%;
          padding: 10px;
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 4px;
          font-family: var(--font-ui);
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .start-session-btn:hover { background: var(--accent-dim); }

        /* ── Main panel ───────────────────────────── */
        .workspace-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .workspace-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }

        .topbar-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 11px;
        }

        .privacy-badge {
          padding: 3px 8px;
          border: 1px solid var(--border);
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .workspace-content {
          flex: 1;
          overflow-y: auto;
          padding: 40px 48px;
          max-width: 800px;
        }

        /* ── Module states ────────────────────────── */
        .module-empty-state,
        .module-generating-state,
        .module-error-state,
        .module-draft-state {
          padding: 48px 0;
          color: var(--text-muted);
        }

        .empty-label, .error-label, .draft-badge {
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .draft-badge { color: var(--warn); }
        .error-label { color: var(--error); }

        .empty-sub, .error-sub {
          font-size: 13px;
          line-height: 1.6;
          max-width: 400px;
        }

        @keyframes shimmer {
          0% { opacity: 0.3; }
          50% { opacity: 0.7; }
          100% { opacity: 0.3; }
        }

        .generating-line {
          height: 2px;
          background: var(--accent);
          width: 120px;
          margin-bottom: 16px;
          animation: shimmer 1.5s ease infinite;
        }

        .generating-label {
          font-size: 12px;
          color: var(--text-muted);
          letter-spacing: 0.04em;
        }

        /* ── Module content ───────────────────────── */
        .module-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
        }

        .module-title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: normal;
          color: var(--text);
          letter-spacing: -0.01em;
        }

        .refine-btn {
          padding: 6px 14px;
          background: none;
          border: 1px solid var(--border);
          color: var(--text-muted);
          font-family: var(--font-ui);
          font-size: 11px;
          cursor: pointer;
          border-radius: 3px;
          transition: border-color 0.15s, color 0.15s;
          letter-spacing: 0.04em;
        }

        .refine-btn:hover { border-color: var(--accent); color: var(--accent); }

        .confidence-banner {
          margin-bottom: 20px;
        }

        .inferred-note {
          font-size: 11px;
          color: var(--warn);
          padding: 6px 12px;
          background: rgba(217, 119, 6, 0.08);
          border-left: 2px solid var(--warn);
          display: block;
        }

        .module-body {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .one-liner {
          font-family: var(--font-display);
          font-size: 20px;
          color: var(--text);
          line-height: 1.5;
          font-style: italic;
          padding: 24px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .field-label {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .field-value {
          font-size: 14px;
          line-height: 1.7;
          color: var(--text);
          max-width: 600px;
        }

        .field-list {
          padding-left: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-list li {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text);
        }

        .tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag {
          padding: 3px 10px;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 3px;
          font-size: 11px;
          color: var(--text-muted);
        }

        .pain-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 3px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          background: var(--surface-raised);
          color: var(--text-muted);
        }

        .pain-badge[data-level="critical"] { color: var(--error); border: 1px solid var(--error); }
        .pain-badge[data-level="high"] { color: var(--warn); }

        /* ── Scorecard ─────────────────────────────── */
        .score-rings-row {
          display: flex;
          gap: 24px;
          padding: 24px 0;
          flex-wrap: wrap;
        }

        .score-ring-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .ring-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .critic-concerns {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-top: 8px;
        }

        .concern-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .concern-tag {
          flex-shrink: 0;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 3px 8px;
          background: var(--surface-raised);
          border-radius: 2px;
          margin-top: 2px;
        }

        .concern-text {
          font-size: 13px;
          line-height: 1.6;
          color: var(--text);
        }

        .pivot-offer {
          padding: 14px 16px;
          background: rgba(220, 38, 38, 0.06);
          border-left: 2px solid var(--error);
          font-size: 13px;
          color: var(--text-muted);
        }

        .pivot-link {
          background: none;
          border: none;
          color: var(--accent);
          font-family: var(--font-ui);
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          margin-left: 4px;
        }

        .raw-json {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.6;
          overflow-x: auto;
        }

        /* ── Interview panel ──────────────────────── */
        .interview-panel {
          width: 360px;
          min-width: 360px;
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--surface);
        }

        .interview-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .depth-label {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.04em;
        }

        .depth-rings {
          display: flex;
          gap: 4px;
        }

        .depth-ring {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border);
          transition: background 0.4s;
        }

        .depth-ring.filled { background: var(--accent); }

        .messages-list {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message {
          max-width: 90%;
          padding: 10px 14px;
          border-radius: 4px;
          font-size: 13px;
          line-height: 1.6;
        }

        .message.user {
          align-self: flex-end;
          background: var(--surface-raised);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .message.assistant {
          align-self: flex-start;
          color: var(--text);
          padding-left: 0;
        }

        .thinking-indicator {
          padding: 8px 0;
        }

        .thinking-line {
          height: 1px;
          background: var(--accent);
          width: 40px;
          animation: shimmer 1s ease infinite;
        }

        .end-session-offer {
          margin: 0 20px 12px;
          padding: 12px 16px;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.3);
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .end-session-btn {
          display: block;
          margin-top: 10px;
          padding: 8px 14px;
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 3px;
          font-family: var(--font-ui);
          font-size: 12px;
          cursor: pointer;
          width: 100%;
        }

        .input-row {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid var(--border);
        }

        .message-input {
          flex: 1;
          background: var(--ink);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--font-ui);
          font-size: 13px;
          padding: 10px 12px;
          border-radius: 4px;
          resize: none;
          line-height: 1.5;
          outline: none;
          transition: border-color 0.15s;
        }

        .message-input:focus { border-color: var(--accent); }
        .message-input::placeholder { color: var(--text-muted); }

        .send-btn {
          padding: 0 16px;
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.15s;
          align-self: stretch;
        }

        .send-btn:hover { background: var(--accent-dim); }
        .send-btn.disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Module content fade-in ───────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .module-content {
          animation: fadeUp 0.4s ease-out both;
        }
      `}</style>

      {/* Sidebar */}
      <aside className="workspace-sidebar">
        <div className="idea-title">
          {idea.title}
          <div>
            <span
              className="stage-badge"
              style={{ color: stageBadgeColors[idea.stage] ?? '#4B4840' }}
            >
              {idea.stage}
            </span>
          </div>
        </div>

        <div className="sidebar-section-label">Modules</div>

        {orderedModules.map(module => (
          <ModuleCard
            key={module.module_type}
            module={module}
            isSelected={selectedModule === module.module_type}
            onClick={() => setSelectedModule(module.module_type as ModuleType)}
          />
        ))}

        <div className="sidebar-actions">
          <button
            className="start-session-btn"
            onClick={() => {
              setShowInterview(true)
              onStartInterview('initial')
            }}
          >
            {idea.modules.some(m => m.generation_status === 'complete')
              ? '+ New Session'
              : 'Start Interview →'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="workspace-main">
        <div className="workspace-topbar">
          <div className="topbar-meta">
            <span className="privacy-badge">{idea.privacy_status}</span>
            <span>Updated {new Date(idea.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="workspace-content">
          {moduleMap[selectedModule] && (
            <ModuleViewer
              module={moduleMap[selectedModule]}
              onRefine={handleRefine}
              onPivotMode={onPivotMode}
            />
          )}
        </div>
      </main>

      {/* Interview panel */}
      {showInterview && activeSession && (
        <InterviewPanel
          ideaId={idea.id}
          sessionId={activeSession}
          authToken=""  // Pass from auth context in real implementation
          onSessionEnd={() => {
            setShowInterview(false)
            // Trigger module status polling
          }}
        />
      )}
    </div>
  )
}
