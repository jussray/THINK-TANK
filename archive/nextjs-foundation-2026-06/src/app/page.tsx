// src/app/page.tsx
// Root page: logged-in → dashboard, logged-out → landing/sign-in

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const { userId } = await auth()

  if (userId) {
    redirect('/dashboard')
  }

  // Not authed — show minimal landing
  return (
    <div style={{
      minHeight: '100vh',
      background: '#1A1814',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 32,
      padding: 24,
      fontFamily: 'ui-monospace, monospace',
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s ease-out both' }}>
        <p style={{
          fontSize: 11, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: '#4B4840',
          marginBottom: 24,
        }}>
          Think Tank
        </p>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(28px, 5vw, 48px)',
          fontWeight: 'normal',
          color: '#E8E6E1',
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          maxWidth: 480,
          margin: '0 auto 20px',
        }}>
          The AI cofounder that asks the questions you haven't thought of.
        </h1>
        <p style={{
          fontSize: 14, color: '#8A8880',
          lineHeight: 1.6, maxWidth: 380, margin: '0 auto',
        }}>
          An interview engine that understands your idea as deeply as you do,
          then generates everything you need to move from conviction to company.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, animation: 'fadeUp 0.5s 0.15s ease-out both' }}>
        <a
          href="/sign-up"
          style={{
            padding: '11px 28px',
            background: '#2563EB',
            color: '#fff',
            borderRadius: 5,
            fontSize: 13,
            letterSpacing: '0.02em',
          }}
        >
          Start for free →
        </a>
        <a
          href="/sign-in"
          style={{
            padding: '11px 20px',
            background: 'none',
            border: '1px solid #2E2C28',
            color: '#8A8880',
            borderRadius: 5,
            fontSize: 13,
          }}
        >
          Sign in
        </a>
      </div>
    </div>
  )
}
