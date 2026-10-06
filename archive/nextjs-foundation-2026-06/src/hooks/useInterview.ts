'use client'

// src/hooks/useInterview.ts
// Manages the full interview session lifecycle:
//   startSession → stream messages → update concept map → endSession → poll modules
// Consumed by the workspace page and the interview panel component.

import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { trpc } from '@/lib/trpc/client'
import type { InterviewMode, ModuleType } from '@/types/modules'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export interface InterviewState {
  sessionId: string | null
  messages: Message[]
  streaming: boolean
  completeness: number       // 0–1, updated after each turn
  readyToEnd: boolean        // true when completeness >= 0.75
  sessionEnded: boolean
  generating: boolean        // true while post-session pipeline runs
  error: string | null
}

export function useInterview(ideaId: string) {
  const { getToken } = useAuth()
  const utils = trpc.useUtils()

  const [state, setState] = useState<InterviewState>({
    sessionId: null,
    messages: [],
    streaming: false,
    completeness: 0,
    readyToEnd: false,
    sessionEnded: false,
    generating: false,
    error: null,
  })

  const startSessionMutation = trpc.interviews.startSession.useMutation()
  const endSessionMutation = trpc.interviews.endSession.useMutation()

  // ── Start a session ─────────────────────────────────────────────────────────
  const startSession = useCallback(async (
    mode: InterviewMode = 'initial',
    targetModule?: ModuleType
  ) => {
    setState(s => ({ ...s, error: null, sessionEnded: false, messages: [] }))

    const session = await startSessionMutation.mutateAsync({
      ideaId,
      mode,
      targetModule,
    })

    setState(s => ({ ...s, sessionId: session.sessionId }))
    return session.sessionId
  }, [ideaId, startSessionMutation])

  // ── Send a message and stream the response ──────────────────────────────────
  const sendMessage = useCallback(async (
    sessionId: string,
    userMessage: string
  ) => {
    if (state.streaming) return

    // Add user message immediately
    const userMsgId = `user-${Date.now()}`
    const assistantMsgId = `assistant-${Date.now()}`

    setState(s => ({
      ...s,
      streaming: true,
      error: null,
      messages: [
        ...s.messages,
        { id: userMsgId, role: 'user', content: userMessage },
        { id: assistantMsgId, role: 'assistant', content: '', streaming: true },
      ],
    }))

    try {
      const token = await getToken({ template: 'supabase' })

      const res = await fetch('/api/interview/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, userMessage, ideaId }),
      })

      if (!res.ok) throw new Error(`Stream failed: ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true }).split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.text) {
              assistantText += data.text
              setState(s => ({
                ...s,
                messages: s.messages.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, content: assistantText }
                    : m
                ),
              }))
            }

            if (data.done) {
              setState(s => ({
                ...s,
                streaming: false,
                readyToEnd: data.readyToEnd,
                completeness: data.completeness,
                messages: s.messages.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, streaming: false }
                    : m
                ),
              }))
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stream error'
      setState(s => ({
        ...s,
        streaming: false,
        error: msg,
        messages: s.messages.filter(m => m.id !== assistantMsgId),
      }))
    }
  }, [ideaId, state.streaming, getToken])

  // ── End session + trigger pipeline ─────────────────────────────────────────
  const endSession = useCallback(async (sessionId: string) => {
    setState(s => ({ ...s, generating: true, sessionEnded: true }))

    try {
      await endSessionMutation.mutateAsync({ sessionId })

      // Start polling module status
      pollUntilComplete()
    } catch (err) {
      setState(s => ({ ...s, generating: false, error: 'Failed to end session' }))
    }
  }, [endSessionMutation])

  // ── Poll module generation status ───────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pollUntilComplete = useCallback(() => {
    let attempts = 0
    const MAX_ATTEMPTS = 60  // 2 minutes max

    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(pollRef.current!)
        setState(s => ({ ...s, generating: false }))
        return
      }

      // Invalidate modules query — React Query will refetch
      await utils.modules.pollStatus.invalidate({ ideaId })
      const status = await utils.modules.pollStatus.fetch({ ideaId })

      if (status.allComplete) {
        clearInterval(pollRef.current!)
        // Invalidate full idea to refresh workspace
        await utils.ideas.get.invalidate({ ideaId })
        setState(s => ({ ...s, generating: false }))
      }
    }, 2000)  // poll every 2s
  }, [ideaId, utils])

  return {
    state,
    startSession,
    sendMessage,
    endSession,
  }
}
