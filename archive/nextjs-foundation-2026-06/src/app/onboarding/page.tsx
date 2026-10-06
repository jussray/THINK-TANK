'use client'

// src/app/onboarding/page.tsx
// Mode selection + first idea capture.
// Design: full-bleed dark canvas, single centered question, four mode cards.
// The interview has already begun by the time they click a mode.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { trpc } from '@/lib/trpc/client'
import type { FounderMode } from '@/types/modules'

const MODES: Array<{
  id: FounderMode
  label: string
  sub: string
  glyph: string
}> = [
  {
    id: 'dreamer',
    label: 'Dreamer',
    sub: 'Idea stage. First-time or exploring.',
    glyph: '○',
  },
  {
    id: 'builder',
    label: 'Builder',
    sub: 'Actively executing. Post-validation.',
    glyph: '◆',
  },
  {
    id: 'investor',
    label: 'Investor',
    sub: 'Scouts, angels, fund associates.',
    glyph: '◇',
  },
  {
    id: 'team_builder',
    label: 'Team Builder',
    sub: 'Assembling co-founders and early hires.',
    glyph: '◈',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [step, setStep] = useState<'mode' | 'idea'>('mode')
  const [selectedMode, setSelectedMode] = useState<FounderMode | null>(null)
  const [ideaText, setIdeaText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createIdea = trpc.ideas.create.useMutation()
  const updateProfile = trpc.profiles?.update?.useMutation?.()

  async function handleModeSelect(mode: FounderMode) {
    setSelectedMode(mode)
    setStep('idea')
  }

  async function handleStart() {
    if (!ideaText.trim() || !selectedMode) return
    setLoading(true)
    setError(null)

    try {
      // 1. Create the idea (title extracted from first sentence)
      const title = ideaText.split(/[.!?]/)[0].trim().slice(0, 120) || 'Untitled Idea'
      const idea = await createIdea.mutateAsync({ title })

      // 2. Navigate to the workspace — the interview starts immediately there
      router.push(`/ideas/${idea.id}?firstMessage=${encodeURIComponent(ideaText)}&mode=${selectedMode}`)
    } catch (err) {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div style={styles.root}>
      {/* Step 1: Mode selection */}
      {step === 'mode' && (
        <div style={styles.centerStack}>
          <p style={styles.eyebrow}>Think Tank</p>
          <h1 style={styles.headline}>
            Tell me about the problem<br />you keep coming back to.
          </h1>
          <p style={styles.sub}>First, who are you right now?</p>

          <div style={styles.modeGrid}>
            {MODES.map(m => (
              <button
                key={m.id}
                style={styles.modeCard}
                onClick={() => handleModeSelect(m.id)}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2563EB'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#E8E6E1'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2E2C28'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#8A8880'
                }}
              >
                <span style={styles.modeGlyph}>{m.glyph}</span>
                <span style={styles.modeLabel}>{m.label}</span>
                <span style={styles.modeSub}>{m.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: First idea input */}
      {step === 'idea' && (
        <div style={styles.centerStack}>
          <button style={styles.backBtn} onClick={() => setStep('mode')}>
            ← back
          </button>

          <p style={styles.eyebrow}>Think Tank — {MODES.find(m => m.id === selectedMode)?.label}</p>

          <h1 style={styles.headline}>
            Tell me about the problem<br />you keep coming back to.
          </h1>

          <p style={styles.sub}>
            Don't worry about how it sounds. A few sentences is enough to start.
          </p>

          <textarea
            style={styles.textarea}
            value={ideaText}
            onChange={e => setIdeaText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.metaKey) handleStart()
            }}
            placeholder="There's a problem I've noticed…"
            autoFocus
            rows={5}
          />

          {error && <p style={styles.errorText}>{error}</p>}

          <button
            style={{
              ...styles.startBtn,
              opacity: ideaText.trim().length < 10 || loading ? 0.4 : 1,
              cursor: ideaText.trim().length < 10 || loading ? 'not-allowed' : 'pointer',
            }}
            onClick={handleStart}
            disabled={ideaText.trim().length < 10 || loading}
          >
            {loading ? 'Starting…' : 'Start the interview →'}
          </button>

          <p style={styles.hint}>⌘ + Enter to continue</p>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#1A1814',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  centerStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    maxWidth: 560,
    width: '100%',
    gap: 0,
    animation: 'fadeUp 0.5s ease-out both',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#8A8880',
    marginBottom: 28,
  },
  headline: {
    fontFamily: 'Georgia, serif',
    fontSize: 'clamp(26px, 4vw, 38px)',
    fontWeight: 'normal',
    color: '#E8E6E1',
    lineHeight: 1.25,
    marginBottom: 16,
    letterSpacing: '-0.01em',
  },
  sub: {
    fontSize: 14,
    color: '#8A8880',
    lineHeight: 1.6,
    marginBottom: 40,
  },
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    width: '100%',
  },
  modeCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '20px 20px',
    background: '#222018',
    border: '1px solid #2E2C28',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
    color: '#8A8880',
    transition: 'border-color 0.15s, color 0.15s',
  },
  modeGlyph: {
    fontSize: 20,
    lineHeight: 1,
    color: '#2563EB',
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Georgia, serif',
    color: 'inherit',
  },
  modeSub: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#6B6860',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#8A8880',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    marginBottom: 32,
    letterSpacing: '0.04em',
  },
  textarea: {
    width: '100%',
    background: '#222018',
    border: '1px solid #2E2C28',
    borderRadius: 6,
    color: '#E8E6E1',
    fontSize: 15,
    lineHeight: 1.7,
    padding: '16px 20px',
    resize: 'vertical',
    outline: 'none',
    marginBottom: 20,
    transition: 'border-color 0.15s',
    fontFamily: 'Georgia, serif',
  },
  startBtn: {
    padding: '12px 24px',
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    fontSize: 14,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'background 0.15s, opacity 0.15s',
    marginBottom: 12,
  },
  hint: {
    fontSize: 11,
    color: '#4B4840',
    letterSpacing: '0.04em',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 12,
  },
}
