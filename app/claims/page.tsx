'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import * as XLSX from 'xlsx'

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
  action_type: string | null
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
  const [showExport, setShowExport] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [exportYear, setExportYear] = useState(new Date().getFullYear())
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1)
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

  function handleExcelExport() {
    const pad = (n: number) => String(n).padStart(2, '0')
    const target = `${exportYear}-${pad(exportMonth)}`
    const monthClaims = claims.filter(c => c.claim_date.startsWith(target))

    if (monthClaims.length === 0) {
      alert(`${exportYear}년 ${exportMonth}월 클레임이 없습니다.`)
      return
    }

    const wb = XLSX.utils.book_new()

    // ── 목록 시트 ──
    const listHeader = ['No', '날짜', '거래처', '담당자', '연락처', '유형', '처리유형', '클레임 내용', '조치 내용', '상태', '완료일시', '등록자']
    const listData = monthClaims.map((c, i) => [
      i + 1,
      c.claim_date,
      c.company,
      c.contact || '',
      c.phone || '',
      c.category,
      c.action_type || '',
      c.content,
      c.action_taken || '',
      c.status,
      c.resolved_at ? new Date(c.resolved_at).toLocaleDateString('ko-KR') : '',
      c.profiles?.name || c.profiles?.email || '',
    ])
    const ws1 = XLSX.utils.aoa_to_sheet([listHeader, ...listData])

    ws1['!cols'] = [
      { wch: 4 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
      { wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 30 }, { wch: 8 }, { wch: 14 }, { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, ws1, '목록')

    // ── 상세 시트 (1행 per claim 플랫 테이블) ──
    const detailHeader = ['No', '날짜', '거래처', '담당자', '연락처', '클레임 유형', '처리 유형', '클레임 내용', '조치 내용', '상태', '완료일시', '등록자']
    const detailData = monthClaims.map((c, i) => [
      i + 1,
      c.claim_date,
      c.company,
      c.contact || '',
      c.phone || '',
      c.category,
      c.action_type || '',
      c.content,
      c.action_taken || '',
      c.status,
      c.resolved_at ? new Date(c.resolved_at).toLocaleDateString('ko-KR') : '',
      c.profiles?.name || c.profiles?.email || '',
    ])
    const ws2 = XLSX.utils.aoa_to_sheet([detailHeader, ...detailData])
    ws2['!cols'] = [
      { wch: 4 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
      { wch: 8 }, { wch: 12 }, { wch: 45 }, { wch: 35 }, { wch: 8 }, { wch: 14 }, { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, ws2, '상세')

    // ── 월별현황 시트 ──
    const allYears = [...new Set(claims.map(c => c.claim_date.substring(0, 4)))].sort()
    const summaryHeader = ['월', '총건수', '접수', '처리중', '완료', '불량', '배송', 'AS', '계약', '기타']
    const summaryData: (string | number)[][] = []
    for (const yr of allYears) {
      for (let m = 1; m <= 12; m++) {
        const key = `${yr}-${pad(m)}`
        const mc = claims.filter(c => c.claim_date.startsWith(key))
        if (mc.length === 0) continue
        summaryData.push([
          `${yr}.${pad(m)}`,
          mc.length,
          mc.filter(c => c.status === '접수').length,
          mc.filter(c => c.status === '처리중').length,
          mc.filter(c => c.status === '완료').length,
          mc.filter(c => c.category === '불량').length,
          mc.filter(c => c.category === '배송').length,
          mc.filter(c => c.category === 'AS').length,
          mc.filter(c => c.category === '계약').length,
          mc.filter(c => c.category === '기타').length,
        ])
      }
    }
    const ws3 = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryData])
    ws3['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 6 }, { wch: 7 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }]
    XLSX.utils.book_append_sheet(wb, ws3, '월별현황')

    XLSX.writeFile(wb, `클레임_${exportYear}년${pad(exportMonth)}월.xlsx`)
    setShowExport(false)
  }

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
      {/* Header — 1줄 */}
      <header style={{ background: '#dc2626', color: '#fff', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6, height: 46 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>📋</span>
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', marginRight: 2 }}>클레임</span>
        {/* 상태 필터 탭 */}
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', gap: 0, alignSelf: 'stretch', alignItems: 'center' }}>
          {STATUS_LIST.map(s => {
            const cnt = s === '전체' ? claims.length : claims.filter(c => c.status === s).length
            const active = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '0 8px', height: '100%', border: 'none', background: 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: active ? 700 : 400, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: active ? '2px solid #fff' : '2px solid transparent', flexShrink: 0 }}>
                {s}{cnt > 0 && <span style={{ marginLeft: 3, background: active ? '#fff' : 'rgba(255,255,255,0.25)', color: active ? '#dc2626' : '#fff', borderRadius: 8, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>{cnt}</span>}
              </button>
            )
          })}
        </div>
        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => { setShowForm(true); setMsg('') }} style={{ background: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+등록</button>
          <button onClick={() => router.push('/claims/stats')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer', fontSize: 12 }}>📊</button>
          <button onClick={() => setShowExport(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer', fontSize: 12 }}>📥</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer', fontSize: 12 }}>일지</button>
          {isAdmin && <button onClick={() => router.push('/admin')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer', fontSize: 12 }}>관리자</button>}
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px' }}>

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
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, borderLeft: '3px solid #dc2626', paddingLeft: 10 }}>
              {date.replace(/-/g, '.')} · {grouped[date].length}건
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {grouped[date].map(claim => {
                const ss = STATUS_STYLE[claim.status] || STATUS_STYLE['접수']
                const cs = CAT_STYLE[claim.category] || CAT_STYLE['기타']
                return (
                  <div key={claim.id}
                    onClick={() => router.push(`/claims/${claim.id}`)}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{claim.company}</div>
                    <span style={{ background: cs.bg, color: cs.text, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{claim.category}</span>
                    {claim.photos?.length > 0 && <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>📷{claim.photos.length}</span>}
                    <span style={{ background: ss.bg, color: ss.text, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{ss.icon} {claim.status}</span>
                    <span style={{ color: '#cbd5e1', fontSize: 18, flexShrink: 0 }}>›</span>
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
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ background: '#dc2626', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>📋 클레임 등록</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px 20px 0', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <label style={lbl}>날짜 *<input type="date" required value={form.claim_date} onChange={e => setForm(p => ({ ...p, claim_date: e.target.value }))} style={inp} /></label>
                <label style={lbl}>클레임 유형 *
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
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

      {/* 엑셀 내보내기 모달 */}
      {showExport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 360, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a', marginBottom: 6 }}>📊 월별 Excel 내보내기</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>목록 시트 + 상세 시트로 저장됩니다</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <label style={lbl}>연도
                <select value={exportYear} onChange={e => setExportYear(Number(e.target.value))} style={inp}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                </select>
              </label>
              <label style={lbl}>월
                <select value={exportMonth} onChange={e => setExportMonth(Number(e.target.value))} style={inp}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowExport(false)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 10, padding: 12, color: '#475569', cursor: 'pointer', fontSize: 14 }}>취소</button>
              <button onClick={handleExcelExport} style={{ flex: 2, background: '#16a34a', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>📥 다운로드</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#475569' }
const inp: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', color: '#1e293b', fontSize: 14, outline: 'none', marginTop: 2 }
