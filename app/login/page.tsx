'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('이메일 또는 비밀번호가 틀렸습니다.'); return }
      router.push('/dashboard')
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { setError('이메일 발송에 실패했습니다.'); setLoading(false); return }
    setResetSent(true)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
        padding: '48px 40px', width: '100%', maxWidth: 400,
      }}>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>영업활동일지</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
          {mode === 'login' ? '이메일과 비밀번호로 로그인하세요' : '비밀번호 재설정 메일을 보내드립니다'}
        </p>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input type="email" placeholder="이메일" value={email}
              onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="비밀번호" value={password}
              onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? '처리 중...' : '로그인'}
            </button>
            <button type="button" onClick={() => { setMode('reset'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
              비밀번호를 모르시나요?
            </button>
          </form>
        ) : resetSent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <p style={{ color: '#fff', fontWeight: 600, marginBottom: 8 }}>메일을 확인해주세요</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 24 }}>
              <b style={{ color: '#4fc3f7' }}>{email}</b>로<br />비밀번호 설정 링크를 발송했습니다
            </p>
            <button onClick={() => { setMode('login'); setResetSent(false) }}
              style={{ ...btnStyle, fontSize: 14 }}>로그인으로 돌아가기</button>
          </div>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input type="email" placeholder="등록된 이메일 주소" value={email}
              onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? '발송 중...' : '📧 비밀번호 설정 메일 발송'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer' }}>
              ← 로그인으로 돌아가기
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10, padding: '12px 16px', color: '#fff', fontSize: 15, outline: 'none',
}
const btnStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #4fc3f7, #0288d1)',
  border: 'none', borderRadius: 10, padding: '14px', color: '#fff',
  fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 8,
}
