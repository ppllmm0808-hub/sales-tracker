'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Mode = 'main' | 'magic' | 'magic_sent' | 'email_pw'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('main')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleGoogleLogin() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError('구글 로그인 실패: ' + error.message); setLoading(false) }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    })
    if (error) {
      const msg = error.message.includes('Signups not allowed') || error.message.includes('not allowed')
        ? '등록되지 않은 이메일입니다. 관리자에게 문의하세요.'
        : '링크 발송 실패: ' + error.message
      setError(msg); setLoading(false); return
    }
    setMode('magic_sent')
    setLoading(false)
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('이메일 또는 비밀번호가 틀렸습니다.'); setLoading(false); return }
    router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '20px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
        padding: '48px 40px', width: '100%', maxWidth: 400,
      }}>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>영업활동일지</h1>

        {error && <p style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 16, marginTop: 8 }}>{error}</p>}

        {/* 메인 화면 */}
        {mode === 'main' && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 28 }}>
              로그인 방법을 선택하세요
            </p>

            {/* 구글 로그인 */}
            <button onClick={handleGoogleLogin} disabled={loading} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              background: '#fff', border: 'none', borderRadius: 10, padding: '14px 20px',
              color: '#1a1a1a', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, marginBottom: 12,
            }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              {loading ? '처리 중...' : 'Google 계정으로 로그인'}
            </button>

            {/* 이메일 매직 링크 */}
            <button onClick={() => { setMode('magic'); setError('') }} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10, padding: '14px 20px',
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 20,
            }}>
              <span style={{ fontSize: 18 }}>📧</span>
              이메일로 로그인 링크 받기
            </button>

            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center' }}>
              등록되지 않은 계정은 관리자에게 문의하세요
            </p>

            <button onClick={() => { setMode('email_pw'); setError('') }}
              style={{
                display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.2)', fontSize: 11, cursor: 'pointer', textAlign: 'center',
              }}>비밀번호로 로그인</button>
          </>
        )}

        {/* 매직 링크 입력 */}
        {mode === 'magic' && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              등록된 이메일을 입력하면<br />로그인 링크를 보내드립니다
            </p>
            <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="email" placeholder="이메일 주소" value={email}
                onChange={e => setEmail(e.target.value)} required autoFocus style={inputStyle} />
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? '발송 중...' : '📧 로그인 링크 발송'}
              </button>
              <button type="button" onClick={() => { setMode('main'); setError('') }}
                style={backBtnStyle}>← 뒤로</button>
            </form>
          </>
        )}

        {/* 매직 링크 발송 완료 */}
        {mode === 'magic_sent' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📬</div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>메일을 확인하세요!</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              <b style={{ color: '#4fc3f7' }}>{email}</b>으로<br />
              로그인 링크를 보냈습니다.<br />
              링크를 클릭하면 자동으로 로그인됩니다.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 20 }}>
              링크는 1시간 동안 유효합니다
            </p>
            <button onClick={() => { setMode('magic'); setError('') }} style={backBtnStyle}>
              다시 보내기
            </button>
          </div>
        )}

        {/* 이메일+비밀번호 로그인 */}
        {mode === 'email_pw' && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              이메일과 비밀번호로 로그인
            </p>
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="email" placeholder="이메일" value={email}
                onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              <input type="password" placeholder="비밀번호" value={password}
                onChange={e => setPassword(e.target.value)} required style={inputStyle} />
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? '처리 중...' : '로그인'}
              </button>
              <button type="button" onClick={() => { setMode('main'); setError('') }}
                style={backBtnStyle}>← 뒤로</button>
            </form>
          </>
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
  fontSize: 15, fontWeight: 600, cursor: 'pointer',
}
const backBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
  fontSize: 13, cursor: 'pointer', textAlign: 'center' as const,
}
