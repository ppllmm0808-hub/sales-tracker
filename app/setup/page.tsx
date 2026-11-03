'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SetupPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function handleSetup() {
    setStatus('loading')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) { setMsg('로그인이 필요합니다'); setStatus('error'); return }

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()

    if (res.ok) {
      setMsg(result.message || '완료!')
      setStatus('done')
      setTimeout(() => router.push('/admin'), 2000)
    } else {
      setMsg(result.error || '오류가 발생했습니다')
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
        padding: '48px 40px', width: '100%', maxWidth: 420, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>프로그램 관리자 설정</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 32, lineHeight: 1.7 }}>
          ppllmm0808@gmail.com 계정을<br />
          <b style={{ color: '#fbbf24' }}>프로그램 관리자(owner)</b>로 설정합니다.<br />
          이 작업은 한 번만 실행하면 됩니다.
        </p>

        {status === 'idle' && (
          <button onClick={handleSetup} style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            border: 'none', borderRadius: 12, padding: '14px 32px',
            color: '#000', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>
            ⭐ 프로그램 관리자로 설정
          </button>
        )}

        {status === 'loading' && (
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>설정 중...</p>
        )}

        {status === 'done' && (
          <div>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <p style={{ color: '#4ade80', fontWeight: 700, fontSize: 16 }}>{msg}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 }}>관리자 페이지로 이동 중...</p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p style={{ color: '#ff6b6b', marginBottom: 16, lineHeight: 1.6 }}>{msg}</p>
            <button onClick={() => setStatus('idle')} style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '10px 20px', color: '#fff', cursor: 'pointer',
            }}>다시 시도</button>
          </div>
        )}
      </div>
    </div>
  )
}
