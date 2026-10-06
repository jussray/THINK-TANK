// src/app/api/webhooks/clerk/route.ts
// Clerk webhook: syncs user creation/updates to the profiles table.
// Clerk manages auth — this table stores app-level data.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Verify Clerk webhook signature
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()

  let event: { type: string; data: Record<string, unknown> }
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = event

  if (type === 'user.created' || type === 'user.updated') {
    const userId = data.id as string
    const emailAddresses = data.email_addresses as Array<{ email_address: string }>
    const firstName = data.first_name as string | null
    const lastName = data.last_name as string | null
    const imageUrl = data.image_url as string | null

    await db.from('profiles').upsert(
      {
        id: userId,
        display_name: [firstName, lastName].filter(Boolean).join(' ') || null,
        avatar_url: imageUrl,
      },
      { onConflict: 'id', ignoreDuplicates: false }
    )
  }

  if (type === 'user.deleted') {
    const userId = data.id as string
    // Cascade deletes handle ideas, modules, interviews via FK constraints
    await db.from('profiles').delete().eq('id', userId)
  }

  return NextResponse.json({ success: true })
}
