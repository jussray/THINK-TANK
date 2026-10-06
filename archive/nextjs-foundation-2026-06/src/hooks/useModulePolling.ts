'use client'

// src/hooks/useModulePolling.ts
// Polls module generation status after a session ends.
// Returns a live status map so the workspace sidebar shows real-time dots.

import { useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'

export function useModulePolling(ideaId: string, enabled: boolean) {
  const utils = trpc.useUtils()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: status } = trpc.modules.pollStatus.useQuery(
    { ideaId },
    {
      enabled,
      refetchInterval: enabled ? 2000 : false,
      refetchIntervalInBackground: false,
    }
  )

  // When all modules complete, invalidate the full idea query
  useEffect(() => {
    if (status?.allComplete) {
      utils.ideas.get.invalidate({ ideaId })
    }
  }, [status?.allComplete, ideaId, utils])

  return {
    statusMap: status?.statusMap ?? {},
    allComplete: status?.allComplete ?? false,
    anyGenerating: status?.anyGenerating ?? false,
  }
}
