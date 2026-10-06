'use client'

// src/app/dashboard/page.tsx
// Founder's home after auth. Lists all ideas, links to onboarding for new ones.

import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { useUser } from '@clerk/nextjs'
import { MODULE_REGISTRY } from '@/types/modules'
import type { IdeaStage } from '@/types/modules'

const STAGE_COLOR: Record<IdeaStage, string> = {
  idea:      '#4B4840',
  blueprint: '#2563EB',
  prototype: '#7C3AED',
  beta:      '#D97706',
  revenue:   '#059669',
  growth:    '#DC2626',
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useUser()
  const { data: ideas, isLoading } = trpc.ideas.list.useQuery()

  return (
    <div style={s.root}>
      <header style={s.header}>
        <span style={s.wordmark}>Think Tank</span>
        <span style={s.greeting}>
          {user?.firstName ? `${user.firstName}.` : ''}
        </span>
      </header>

      <main style={s.main}>
        {isLoading ? (
          <LoadingRow />
        ) : (
          <>
            {/* New idea CTA */}
            <button style={s.newIdeaBtn} onClick={() => router.push('/onboarding')}>
              <span style={s.newIdeaGlyph}>+</span>
              <div style={s.newIdeaText}>
                <span style={s.newIdeaLabel}>New idea</span>
                <span style={s.newIdeaSub}>Start an interview</span>
              </div>
            </button>

            {/* Idea cards */}
            {(ideas ?? []).map(idea => {
              const summaryModule = (idea.modules as any[])?.find(
                (m: any) => m.module_type === 'summary'
              )
              const oneLiner = summaryModule?.content_json?.one_liner ?? null

              return (
                <button
                  key={idea.id}
                  style={s.ideaCard}
                  onClick={() => router.push(`/ideas/${idea.id}`)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#2E2C28'
                  }}
                >
                  <div style={s.ideaCardTop}>
                    <span style={s.ideaTitle}>{idea.title}</span>
                    <span style={{
                      ...s.stageDot,
                      background: STAGE_COLOR[idea.stage as IdeaStage] ?? '#4B4840',
                    }} />
                  </div>
                  {oneLiner && (
                    <p style={s.ideaOneLiner}>"{oneLiner}"</p>
                  )}
                  <div style={s.ideaMeta}>
                    <span style={{
                      ...s.stageBadge,
                      color: STAGE_COLOR[idea.stage as IdeaStage] ?? '#4B4840',
                    }}>
                      {idea.stage}
                    </span>
                    <span style={s.ideaDate}>
                      {new Date(idea.updated_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>
                </button>
              )
            })}

            {!isLoading && (ideas ?? []).length === 0 && (
              <p style={s.emptyNote}>No ideas yet. Start your first interview above.</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function LoadingRow() {
  return (
    <div style={{ padding: '40px 0' }}>
      <div style={{
        height: 1, width: 48, background: '#2563EB',
        animation: 'shimmer 1s ease infinite',
      }} />
      <style>{`@keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#1A1814',
    color: '#E8E6E1',
    fontFamily: 'ui-monospace, monospace',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 40px',
    borderBottom: '1px solid #2E2C28',
  },
  wordmark: {
    fontSize: 13,
    letterSpacing: '0.08em',
    color: '#E8E6E1',
  },
  greeting: {
    fontSize: 12,
    color: '#8A8880',
    fontFamily: 'Georgia, serif',
  },
  main: {
    maxWidth: 680,
    margin: '0 auto',
    padding: '48px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  newIdeaBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '20px 24px',
    background: 'none',
    border: '1px dashed #2E2C28',
    borderRadius: 6,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    marginBottom: 8,
    transition: 'border-color 0.15s',
    color: 'inherit',
  },
  newIdeaGlyph: {
    fontSize: 22,
    color: '#2563EB',
    lineHeight: 1,
    fontWeight: 300,
  },
  newIdeaText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  newIdeaLabel: {
    fontSize: 13,
    color: '#E8E6E1',
  },
  newIdeaSub: {
    fontSize: 11,
    color: '#8A8880',
    letterSpacing: '0.04em',
  },
  ideaCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '20px 24px',
    background: '#222018',
    border: '1px solid #2E2C28',
    borderRadius: 6,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'border-color 0.15s',
    color: 'inherit',
  },
  ideaCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ideaTitle: {
    fontSize: 15,
    fontFamily: 'Georgia, serif',
    color: '#E8E6E1',
    fontWeight: 'normal',
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  ideaOneLiner: {
    fontSize: 12,
    color: '#8A8880',
    fontStyle: 'italic',
    lineHeight: 1.5,
    fontFamily: 'Georgia, serif',
  },
  ideaMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stageBadge: {
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  ideaDate: {
    fontSize: 11,
    color: '#4B4840',
  },
  emptyNote: {
    fontSize: 13,
    color: '#4B4840',
    paddingTop: 16,
  },
}
