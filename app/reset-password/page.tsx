'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('type=invite') || hash.includes('type=signup')) {
      const params = new URLSearchParams(hash.slice(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(() => setReady(true))
          .catch(() => setError('링크가 만료되었습니다. 다시 시도해주세요.'))
      } else {
        setError('유효하지 않은 링크입니다.')
      }
    } else {
      router.replace('/login')
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError('비밀번호 변경에 실패했습니다.'); setLoading(false); return }
    alert('비밀번호가 변경되었습니다.')
    router.replace('/dashboard')
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
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>비밀번호 변경</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>새 비밀번호를 입력하세요</p>

        {error && <p style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>{error}</p>}

        {ready ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input type="password" placeholder="새 비밀번호" value={password}
              onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="비밀번호 확인" value={confirm}
              onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? '처리 중...' : '비밀번호 변경'}
            </button>
          </form>
        ) : !error ? (
          <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>확인 중...</p>
        ) : null}
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
