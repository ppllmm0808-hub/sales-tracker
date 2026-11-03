import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: { absolute: '영업활동일지' },
  description: '영업팀 일일 활동 기록 시스템',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '영업일지',
  },
  icons: {
    apple: '/icon-192.png',
    icon: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
