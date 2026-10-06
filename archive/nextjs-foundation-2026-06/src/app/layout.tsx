// src/app/layout.tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { TRPCProvider } from '@/lib/trpc/provider'

export const metadata: Metadata = {
  title: 'Think Tank',
  description: 'The AI-powered founder ecosystem',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <style>{`
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

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
            }

            html, body {
              height: 100%;
              background: var(--ink);
              color: var(--text);
              font-family: 'ui-monospace', 'Menlo', 'Monaco', monospace;
              font-size: 14px;
              line-height: 1.5;
              -webkit-font-smoothing: antialiased;
            }

            a { color: inherit; text-decoration: none; }
            button { font-family: inherit; }
            input, textarea { font-family: inherit; }

            ::selection {
              background: var(--accent);
              color: #fff;
            }

            ::-webkit-scrollbar { width: 4px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
          `}</style>
        </head>
        <body>
          <TRPCProvider>{children}</TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
