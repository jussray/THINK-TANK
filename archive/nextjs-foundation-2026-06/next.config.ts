// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Path aliases (@/) configured in tsconfig
  experimental: {
    // Required for tRPC streaming in App Router
    serverActions: { bodySizeLimit: '2mb' },
  },
}

export default nextConfig
