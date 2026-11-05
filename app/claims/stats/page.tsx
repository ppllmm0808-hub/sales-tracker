'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Claim = {
  id: string
  claim_date: string
  company: string
  category: string
  status: string
  action_type: string | null
  resolved_at: string | null
  created_at: string
}

const CAT_COLORS: Record<string, string> = {
  '불량': '#dc2626', '배송': '#d97706', 'AS': '#4338ca', '계약': '#059669', '기타': '#475569'
}
const STATUS_COLORS: Record<string, string> = {
  '접수': '#dc2626', '처리중': '#ca8a04', '완료': '#16a34a'
}

function BarChart({ data, colors }: { data: { label: string; value: number }[]; colors: Record<string, string> }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 48, fontSize: 12, color: '#475569', textAlign: 'right', flexShrink: 0 }}>{d.label}</div>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 20, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: colors[d.label] || '#94a3b8', borderRadius: 4, transition: 'width 0.5s', minWidth: d.value > 0 ? 4 : 0 }} />
          </div>
          <div style={{ width: 24, fontSize: 12, fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{d.value}</div>
        </div>
      ))}
    </div>
  )
}

function MonthlyBar({ months }: { months: { label: string; total: number; 완료: number }[] }) {
  const max = Math.max(...months.map(m => m.total), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
      {months.map(m => (
        <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 90, gap: 1 }}>
            <div style={{ width: '100%', background: '#16a34a', height: `${(m.완료 / max) * 90}px`, borderRadius: '2px 2px 0 0', minHeight: m.완료 > 0 ? 2 : 0 }} />
            <div style={{ width: '100%', background: '#fbbf24', height: `${((m.total - m.완료) / max) * 90}px`, borderRadius: m.완료 > 0 ? 0 : '2px 2px 0 0', minHeight: (m.total - m.완료) > 0 ? 2 : 0 }} />
          </div>
          <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>{m.label}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{m.total}</div>
        </div>
      ))}
    </div>
  )
}

export default function ClaimsStatsPage() {
  const router = useRouter()
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) { router.push('/login'); return }

      const res = await fetch('/api/claims', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const all = await res.json()
        setClaims(all)
      }
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <p style={{ color: '#94a3b8' }}>불러오는 중...</p>
    </div>
  )

  const total = claims.length
  const byStatus = ['접수', '처리중', '완료'].map(s => ({ label: s, value: claims.filter(c => c.status === s).length }))
  const byCategory = ['불량', '배송', 'AS', '계약', '기타'].map(s => ({ label: s, value: claims.filter(c => c.category === s).length }))

  // 최근 6개월 월별 집계
  const now = new Date()
  const monthList = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mc = claims.filter(c => c.claim_date.startsWith(key))
    monthList.push({ label: `${d.getMonth() + 1}월`, total: mc.length, 완료: mc.filter(c => c.status === '완료').length })
  }

  // 처리율
  const doneRate = total > 0 ? Math.round((claims.filter(c => c.status === '완료').length / total) * 100) : 0

  // 최다 거래처 TOP 5
  const companyMap: Record<string, number> = {}
  for (const c of claims) companyMap[c.company] = (companyMap[c.company] || 0) + 1
  const topCompanies = Object.entries(companyMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }))
  const topMax = topCompanies[0]?.value || 1

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* 헤더 */}
      <header className="no-print" style={{ background: '#dc2626', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>📊 클레임 대시보드</span>
        <button onClick={() => window.print()} style={{ background: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>🖨️ PDF 저장</button>
      </header>

      {/* 인쇄용 타이틀 */}
      <div className="print-only" style={{ display: 'none', textAlign: 'center', padding: '20px 0 8px', fontWeight: 800, fontSize: 20, color: '#dc2626' }}>
        클레임 대시보드
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 4 }}>출력일: {new Date().toLocaleDateString('ko-KR')}</div>
      </div>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* KPI 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: '전체', value: total, color: '#0f172a', bg: '#fff' },
            { label: '접수', value: byStatus[0].value, color: '#dc2626', bg: '#fef2f2' },
            { label: '처리중', value: byStatus[1].value, color: '#ca8a04', bg: '#fefce8' },
            { label: '완료', value: byStatus[2].value, color: '#16a34a', bg: '#f0fdf4' },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* 처리율 */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>✅ 처리 완료율</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: doneRate >= 70 ? '#16a34a' : doneRate >= 40 ? '#ca8a04' : '#dc2626' }}>{doneRate}%</span>
          </div>
          <div style={{ background: '#f1f5f9', borderRadius: 8, height: 12, overflow: 'hidden' }}>
            <div style={{ width: `${doneRate}%`, height: '100%', background: doneRate >= 70 ? '#16a34a' : doneRate >= 40 ? '#fbbf24' : '#dc2626', borderRadius: 8, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* 월별 추이 */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>📅 월별 추이 (최근 6개월)</div>
          <MonthlyBar months={monthList} />
          <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}><span style={{ width: 10, height: 10, background: '#fbbf24', borderRadius: 2, display: 'inline-block' }} />미완료</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}><span style={{ width: 10, height: 10, background: '#16a34a', borderRadius: 2, display: 'inline-block' }} />완료</span>
          </div>
        </div>

        {/* 유형별 / 상태별 나란히 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 12 }}>📂 클레임 유형</div>
            <BarChart data={byCategory} colors={CAT_COLORS} />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 12 }}>🔄 처리 상태</div>
            <BarChart data={byStatus} colors={STATUS_COLORS} />
          </div>
        </div>

        {/* 클레임 다발 거래처 TOP 5 */}
        {topCompanies.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>🏢 클레임 다발 거래처 TOP 5</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topCompanies.map((c, i) => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: i === 0 ? '#dc2626' : i === 1 ? '#ea580c' : i === 2 ? '#ca8a04' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                    <div style={{ width: `${(c.value / topMax) * 100}%`, height: '100%', background: i === 0 ? '#fca5a5' : '#e2e8f0', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 13, color: '#1e293b', width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', width: 24, textAlign: 'right', flexShrink: 0 }}>{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { margin: 0; background: #fff; }
          @page { margin: 12mm; size: A4; }
          header { position: static !important; }
        }
      `}</style>
    </div>
  )
}
