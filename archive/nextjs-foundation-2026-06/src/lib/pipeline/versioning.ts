// src/lib/pipeline/versioning.ts
// Creates idea_version snapshots and appends ledger entries.
// Called by post-session pipeline and by founder manual actions.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function snapshotVersion(
  ideaId: string,
  changeSummary: string
): Promise<string> {
  const db = getServiceClient()

  // Load all complete modules for this idea
  const { data: modules } = await db
    .from('modules')
    .select('module_type, content_json, confidence_map, generated_at')
    .eq('idea_id', ideaId)
    .eq('generation_status', 'complete')

  // Determine next version number
  const { data: lastVersion } = await db
    .from('idea_versions')
    .select('version_number')
    .eq('idea_id', ideaId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1

  // Build snapshot
  const snapshot = {
    version: nextVersionNumber,
    snapshotted_at: new Date().toISOString(),
    modules: Object.fromEntries(
      (modules ?? []).map(m => [m.module_type, {
        content: m.content_json,
        confidence_map: m.confidence_map,
        generated_at: m.generated_at,
      }])
    ),
  }

  // Compute fingerprint
  const snapshotString = JSON.stringify(snapshot)
  const hash = createHash('sha256').update(snapshotString).digest('hex')

  // Insert version row
  const { data: version, error } = await db
    .from('idea_versions')
    .insert({
      idea_id: ideaId,
      version_number: nextVersionNumber,
      snapshot_json: snapshot,
      change_summary: changeSummary,
      hash_fingerprint: hash,
    })
    .select('id')
    .single()

  if (error || !version) {
    throw new Error(`[Versioning] Failed to create snapshot: ${error?.message}`)
  }

  // Update ideas.current_version_id
  await db
    .from('ideas')
    .update({ current_version_id: version.id })
    .eq('id', ideaId)

  // Append ledger entry
  await appendLedgerEntry(ideaId, version.id, 'version_snapshot', changeSummary)

  return version.id
}

async function appendLedgerEntry(
  ideaId: string,
  versionId: string,
  actionType: string,
  summary: string
) {
  const db = getServiceClient()

  // Get previous hash for chaining
  const { data: prevEntry } = await db
    .from('idea_ownership_ledger')
    .select('block_hash')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const prevHash = prevEntry?.block_hash ?? ''

  const payload = {
    version_id: versionId,
    action_type: actionType,
    summary,
    timestamp: new Date().toISOString(),
  }

  const blockHash = createHash('sha256')
    .update(prevHash + JSON.stringify(payload))
    .digest('hex')

  // Get owner_id
  const { data: idea } = await db
    .from('ideas')
    .select('owner_id')
    .eq('id', ideaId)
    .single()

  await db.from('idea_ownership_ledger').insert({
    idea_id: ideaId,
    user_id: idea?.owner_id,
    action_type: actionType,
    version_id: versionId,
    payload_json: payload,
    block_hash: blockHash,
    prev_hash: prevHash || null,
  })
}
