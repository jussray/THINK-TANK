// Working copy of the interview route for review, not active application code.
// The archived June original is intentionally unchanged.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { claude, MODELS, heliconeTag } from '@/lib/ai/client'
import { updateConceptMap, isSessionReadyToEnd } from '@/lib/agents/interview'
import { verifyBearerIdentity } from '../../../auth/verified-identity'
import { canAccessInterview } from '../../../auth/interview-scope'
import type { ConceptMap } from '@/types/modules'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const identity = await verifyBearerIdentity(req.headers.get('Authorization'), {
    issuer: process.env.CLERK_JWT_ISSUER ?? '',
    audience: process.env.CLERK_JWT_AUDIENCE ?? '',
    jwksUrl: process.env.CLERK_JWKS_URL ?? '',
  })
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let input: unknown
  try { input = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!input || typeof input !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { sessionId, ideaId, userMessage } = input as Record<string, unknown>
  if (typeof sessionId !== 'string' || typeof ideaId !== 'string' ||
      typeof userMessage !== 'string' || !userMessage.trim() ||
      userMessage.length > 20000) {
    return NextResponse.json({ error: 'Invalid request fields' }, { status: 400 })
  }

  // Service-role access is restricted to server-side operations after verified auth.
  // Further reduction of service-role use and Supabase RLS integration remain required.
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: session, error: sessionError } = await db
    .from('interviews')
    .select('id, idea_id, concept_map, ideas!inner(owner_id)')
    .eq('id', sessionId)
    .eq('idea_id', ideaId)
    .single()

  if (sessionError || !session || !canAccessInterview(identity.userId, sessionId, ideaId, {
    sessionId: session.id,
    ideaId: session.idea_id,
    ownerId: (session.ideas as { owner_id: string }).owner_id,
  })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: insertError } = await db.from('interview_messages').insert({
    interview_id: sessionId, role: 'user', content: userMessage,
  })
  if (insertError) return NextResponse.json({ error: 'Unable to save message' }, { status: 500 })

  const { data: messages, error: historyError } = await db
    .from('interview_messages').select('role, content')
    .eq('interview_id', sessionId).order('created_at', { ascending: true })
  if (historyError || !messages) return NextResponse.json({ error: 'Unable to load messages' }, { status: 500 })

  const systemMessage = messages.find(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant')
  const stream = claude.messages.stream({
    model: MODELS.interview, max_tokens: 400, system: systemMessage?.content ?? '',
    messages: conversationMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  }, heliconeTag(ideaId, 'interview'))

  const encoder = new TextEncoder()
  let fullText = ''
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullText += chunk.delta.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
          }
        }
        const finalMessage = await stream.finalMessage()
        const { error: assistantError } = await db.from('interview_messages').insert({
          interview_id: sessionId, role: 'assistant', content: fullText,
          agent_persona: 'interview', token_count: finalMessage.usage?.output_tokens ?? null,
        })
        if (assistantError) throw new Error('Unable to save assistant response')
        const updatedMap = await updateConceptMap(session.concept_map as ConceptMap, fullText, ideaId)
        const { error: mapError } = await db.from('interviews').update({ concept_map: updatedMap }).eq('id', sessionId)
        if (mapError) throw new Error('Unable to save concept map')
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          done: true, readyToEnd: isSessionReadyToEnd(updatedMap),
          completeness: updatedMap.overall_completeness,
        })}\n\n`))
        controller.close()
      } catch {
        controller.error(new Error('Interview stream failed'))
      }
    },
  })
  return new Response(readable, { headers: {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
  } })
}
