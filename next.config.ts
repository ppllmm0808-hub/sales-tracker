import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // HTML 페이지는 캐시 안 함
        source: '/((?!_next/static|_next/image|favicon|icon|manifest|sw).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
