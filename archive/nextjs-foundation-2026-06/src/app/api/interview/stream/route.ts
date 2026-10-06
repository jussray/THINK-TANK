// src/app/api/interview/stream/route.ts
// Next.js Route Handler for streaming interview turns.
// tRPC cannot stream — this route handles the real-time conversation.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { claude, MODELS, heliconeTag } from '@/lib/ai/client'
import { updateConceptMap, isSessionReadyToEnd } from '@/lib/agents/interview'
import type { ConceptMap } from '@/types/modules'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') ?? null

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract userId from Clerk JWT
  let userId: string
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    userId = payload.sub
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { sessionId, userMessage, ideaId } = await req.json()

  if (!sessionId || !userMessage || !ideaId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Service-role client for reading system prompt and writing messages
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify session belongs to this user
  const { data: session } = await db
    .from('interviews')
    .select('id, idea_id, concept_map, ideas!inner(owner_id)')
    .eq('id', sessionId)
    .single()

  if (!session || (session.ideas as { owner_id: string }).owner_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Save user message
  await db.from('interview_messages').insert({
    interview_id: sessionId,
    role: 'user',
    content: userMessage,
  })

  // Load full message history (including system prompt)
  const { data: messages } = await db
    .from('interview_messages')
    .select('role, content')
    .eq('interview_id', sessionId)
    .order('created_at', { ascending: true })

  // Separate system prompt from conversation messages
  const systemMessage = messages?.find(m => m.role === 'system')
  const conversationMessages = (messages ?? []).filter(m => m.role !== 'system')

  // Build message array for Claude
  const claudeMessages = conversationMessages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Stream from Claude
  const stream = claude.messages.stream(
    {
      model: MODELS.interview,
      max_tokens: 400,
      system: systemMessage?.content ?? '',
      messages: claudeMessages,
    },
    heliconeTag(ideaId, 'interview')
  )

  // Create a TransformStream to handle the response
  const encoder = new TextEncoder()
  let fullText = ''

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text
          fullText += text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
      }

      // Stream complete — save assistant message and update concept map
      const finalMessage = await stream.finalMessage()
      const tokenCount = finalMessage.usage?.output_tokens ?? null

      await db.from('interview_messages').insert({
        interview_id: sessionId,
        role: 'assistant',
        content: fullText,
        agent_persona: 'interview',
        token_count: tokenCount,
      })

      // Update concept map (non-blocking to client, but awaited before closing stream)
      const currentMap = session.concept_map as ConceptMap
      const updatedMap = await updateConceptMap(currentMap, fullText, ideaId)

      await db
        .from('interviews')
        .update({ concept_map: updatedMap })
        .eq('id', sessionId)

      // Signal if session is ready to end
      const readyToEnd = isSessionReadyToEnd(updatedMap)
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          done: true,
          readyToEnd,
          completeness: updatedMap.overall_completeness,
        })}\n\n`)
      )

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
