'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      router.replace('/reset-password' + hash)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
      else router.replace('/login')
    }).catch(() => router.replace('/login'))
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>로딩 중...</p>
    </div>
  )
}
