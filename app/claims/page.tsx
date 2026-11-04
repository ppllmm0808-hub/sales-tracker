'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'

const CATEGORIES = ['불량', '배송', 'AS', '계약', '기타']
const STATUS_LIST = ['전체', '접수', '처리중', '완료']

const CAT_STYLE: Record<string, { bg: string; text: string }> = {
  '불량': { bg: '#fee2e2', text: '#dc2626' },
  '배송': { bg: '#fef3c7', text: '#d97706' },
  'AS':   { bg: '#e0e7ff', text: '#4338ca' },
  '계약': { bg: '#d1fae5', text: '#059669' },
  '기타': { bg: '#f1f5f9', text: '#475569' },
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  '접수':  { bg: '#fee2e2', text: '#dc2626', icon: '🔴' },
  '처리중': { bg: '#fef9c3', text: '#ca8a04', icon: '🟡' },
  '완료':  { bg: '#dcfce7', text: '#16a34a', icon: '✅' },
}

type Claim = {
  id: string
  user_id: string
  claim_date: string
  company: string
  contact: string | null
  phone: string | null
  category: string
  content: string
  status: string
  action_taken: string | null
  photos: string[]
  resolved_at: string | null
  created_at: string
  profiles?: { name: string | null; email: string }
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function ClaimsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('전체')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({
    company: '', contact: '', phone: '',
    category: '기타', content: '', claim_date: toDateStr(new Date()),
  })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadClaims = useCallback(async (token: string) => {
    const res = await fetch('/api/claims', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setClaims(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single()
      if (!p) { router.push('/login'); return }
      setProfile(p)
      await loadClaims(data.session.access_token)
    })
  }, [router, loadClaims])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setMsg('')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setMsg('✅ 클레임이 등록됐습니다')
      setForm({ company: '', contact: '', phone: '', category: '기타', content: '', claim_date: toDateStr(new Date()) })
      setShowForm(false)
      await loadClaims(token)
    } else {
      const d = await res.json()
      setMsg(`❌ ${d.error}`)
    }
    setSubmitting(false)
  }

  const filtered = statusFilter === '전체' ? claims : claims.filter(c => c.status === statusFilter)

  // 날짜별 그룹
  const grouped: Record<string, Claim[]> = {}
  for (const c of filtered) {
    if (!grouped[c.claim_date]) grouped[c.claim_date] = []
    grouped[c.claim_date].push(c)
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const pendingCount = claims.filter(c => c.status !== '완료').length
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#64748b' }}>로딩 중...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#dc2626', color: '#fff', padding: isMobile ? '10px 14px' : '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 10px', fontSize: 20, flexShrink: 0 }}>📋</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16 }}>고객 클레임 대장</div>
            {!isMobile && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>클레임 등록 · 처리 · 완료 관리</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {pendingCount > 0 && (
            <span style={{ background: '#fff', color: '#dc2626', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>
              미처리 {pendingCount}건
            </span>
          )}
          <button onClick={() => router.push('/dashboard')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: isMobile ? '5px 10px' : '6px 14px', color: '#fff', cursor: 'pointer', fontSize: isMobile ? 12 : 13, whiteSpace: 'nowrap' }}>일지</button>
          {isAdmin && (
            <button onClick={() => router.push('/admin')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: isMobile ? '5px 10px' : '6px 14px', color: '#fff', cursor: 'pointer', fontSize: isMobile ? 12 : 13, whiteSpace: 'nowrap' }}>관리자</button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px' }}>
        {/* 상단 액션 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10 }}>
          {/* 상태 필터 */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 1 }}>
            {STATUS_LIST.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: statusFilter === s ? '#dc2626' : '#f1f5f9', color: statusFilter === s ? '#fff' : '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {s}{s !== '전체' && claims.filter(c => c.status === s).length > 0 && ` ${claims.filter(c => c.status === s).length}`}
              </button>
            ))}
          </div>
          <button onClick={() => { setShowForm(true); setMsg('') }} style={{ background: '#dc2626', border: 'none', borderRadius: 10, padding: isMobile ? '8px 14px' : '8px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
            + 클레임 등록
          </button>
        </div>

        {msg && !showForm && (
          <div style={{ background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.startsWith('✅') ? '#86efac' : '#fca5a5'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: msg.startsWith('✅') ? '#15803d' : '#dc2626', marginBottom: 14 }}>{msg}</div>
        )}

        {/* 클레임 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>불러오는 중...</div>
        ) : sortedDates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <div style={{ fontSize: 48 }}>📋</div>
            <div style={{ marginTop: 12, fontWeight: 600, color: '#64748b' }}>
              {statusFilter === '전체' ? '등록된 클레임이 없습니다' : `${statusFilter} 상태의 클레임이 없습니다`}
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>위 버튼으로 클레임을 등록하세요</div>
          </div>
        ) : sortedDates.map(date => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, paddingLeft: 2 }}>
              {date.replace(/-/g, '.')} ({grouped[date].length}건)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[date].map(claim => {
                const ss = STATUS_STYLE[claim.status] || STATUS_STYLE['접수']
                const cs = CAT_STYLE[claim.category] || CAT_STYLE['기타']
                return (
                  <div key={claim.id}
                    onClick={() => router.push(`/claims/${claim.id}`)}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'box-shadow 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    {/* 상태 아이콘 */}
                    <div style={{ fontSize: 22, flexShrink: 0 }}>{ss.icon}</div>

                    {/* 내용 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{claim.company}</span>
                        <span style={{ background: cs.bg, color: cs.text, borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{claim.category}</span>
                        <span style={{ background: ss.bg, color: ss.text, borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{claim.status}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claim.content}</div>
                      {isAdmin && claim.profiles && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                          등록: {claim.profiles.name || claim.profiles.email}
                        </div>
                      )}
                    </div>

                    {/* 사진 수 + 화살표 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {claim.photos?.length > 0 && (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>📷{claim.photos.length}</span>
                      )}
                      <span style={{ color: '#94a3b8', fontSize: 22, fontWeight: 300 }}>›</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </main>

      {/* 등록 모달 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ background: '#dc2626', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>📋 클레임 등록</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px 20px 0', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={lbl}>날짜 *<input type="date" required value={form.claim_date} onChange={e => setForm(p => ({ ...p, claim_date: e.target.value }))} style={inp} /></label>
                <label style={lbl}>클레임 유형 *
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={lbl}>거래처명 *<input type="text" required value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} style={inp} placeholder="거래처명" /></label>
                <label style={lbl}>담당자<input type="text" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} style={inp} placeholder="담당자명" /></label>
              </div>
              <label style={lbl}>연락처<input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inp} placeholder="010-0000-0000" /></label>
              <label style={lbl}>클레임 내용 *<textarea required value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} style={{ ...inp, height: 90, resize: 'vertical' }} placeholder="클레임 상세 내용을 입력하세요" /></label>
              {msg && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{msg}</p>}
              <div style={{ display: 'flex', gap: 8, padding: '12px 0 20px' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 10, padding: 13, color: '#475569', cursor: 'pointer', fontSize: 14 }}>취소</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, background: '#dc2626', border: 'none', borderRadius: 10, padding: 13, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
                  {submitting ? '등록 중...' : '클레임 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#475569' }
const inp: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', color: '#1e293b', fontSize: 14, outline: 'none', marginTop: 2 }
