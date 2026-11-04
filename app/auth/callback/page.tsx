'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('로그인 처리 중...')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    async function handleCallback() {
      // PKCE: ?code= 파라미터 처리
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setIsError(true)
          setMessage('인증 오류가 발생했습니다. 다시 시도해주세요.')
          setTimeout(() => router.replace('/login'), 2000)
          return
        }
      }

      await new Promise(r => setTimeout(r, 300))

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      // 등록된 사용자인지 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      // profiles에 없으면 이메일로도 확인 (구글 로그인 첫 접속)
      if (!profile) {
        const { data: profileByEmail } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('email', session.user.email!)
          .single()

        if (!profileByEmail) {
          await supabase.auth.signOut()
          setIsError(true)
          setMessage(`"${session.user.email}" 계정은 등록되지 않았습니다.\n관리자에게 문의해주세요.`)
          setTimeout(() => router.replace('/login'), 3000)
          return
        }

        // profiles id를 auth user id로 업데이트
        await supabase.from('profiles').update({ id: session.user.id }).eq('email', session.user.email!)
      }

      router.replace('/dashboard')
    }

    handleCallback()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
        border: `1px solid ${isError ? 'rgba(255,100,100,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 20, padding: '48px 40px', width: '100%', maxWidth: 400,
        textAlign: 'center',
      }}>
        {!isError && (
          <div style={{
            width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)',
            borderTop: '3px solid #4fc3f7', borderRadius: '50%',
            margin: '0 auto 24px', animation: 'spin 1s linear infinite',
          }} />
        )}
        {isError && <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>}
        <p style={{
          color: isError ? '#ff6b6b' : 'rgba(255,255,255,0.7)',
          fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-line',
        }}>{message}</p>
        {isError && (
          <button onClick={() => router.replace('/login')}
            style={{
              marginTop: 24, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10, padding: '10px 24px', color: '#fff', cursor: 'pointer', fontSize: 14,
            }}>로그인으로 돌아가기</button>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
