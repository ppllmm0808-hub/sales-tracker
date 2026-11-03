import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: '영업활동일지' },
  description: '영업팀 일일 활동 기록 시스템',
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
