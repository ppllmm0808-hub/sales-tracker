'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getAllLogsForDate, getActivitiesByLogIds, getProfile } from '@/lib/supabase'
import type { SalesLog, Activity, Profile } from '@/lib/supabase'

const MEMBER_COLORS = ['#4f46e5','#059669','#dc2626','#d97706','#7c3aed','#0284c7','#be185d','#065f46']

const TYPE_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  '내근': { bg: '#dbeafe', text: '#1d4ed8', icon: '💻' },
  '이동': { bg: '#fef3c7', text: '#b45309', icon: '🚗' },
  '미팅': { bg: '#e0e7ff', text: '#4338ca', icon: '👥' },
  '식사': { bg: '#d1fae5', text: '#065f46', icon: '🍽️' },
  '방문': { bg: '#dbeafe', text: '#1e40af', icon: '📍' },
  '전화': { bg: '#d1fae5', text: '#047857', icon: '📞' },
  '이메일': { bg: '#f3e8ff', text: '#6b21a8', icon: '📧' },
  '제안': { bg: '#fce7f3', text: '#be185d', icon: '📄' },
  '계약': { bg: '#d1fae5', text: '#065f46', icon: '✍️' },
  '기타': { bg: '#f1f5f9', text: '#475569', icon: '📌' },
}

function toDateStr(d: Date) { return d.toISOString().split('T')[0] }
const iStyle: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#1e293b' }

type MemberData = {
  log: SalesLog & { profiles?: Profile }
  activities: Activity[]
  color: string
}

const TYPE_COLORS: Record<string, string> = {
  '방문': '#4f46e5', '미팅': '#7c3aed', '계약': '#059669', '전화': '#0284c7',
  '이메일': '#be185d', '제안': '#d97706', '내근': '#475569', '이동': '#b45309',
  '식사': '#065f46', '기타': '#94a3b8',
}

function ReportView({ data, year, month }: { data: any[], year: number, month: number }) {
  const barRef = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)
  const lineRef = useRef<HTMLCanvasElement>(null)
  const charts = useRef<any[]>([])

  useEffect(() => {
    const initCharts = () => {
      const Chart = (window as any).Chart
      charts.current.forEach(c => c?.destroy())
      charts.current = []
      if (!barRef.current || !donutRef.current || !lineRef.current) return

      // --- 담당자별 활동건수 (Bar) ---
      const personMap: Record<string, { name: string; count: number; contract: number }> = {}
      for (const log of data) {
        const key = log.user_id
        const name = log.profiles?.name || log.profiles?.email || '미확인'
        if (!personMap[key]) personMap[key] = { name, count: 0, contract: 0 }
        personMap[key].count += log.activities.length
        personMap[key].contract += log.activities.filter((a: any) => a.activity_type === '계약').length
      }
      const persons = Object.values(personMap)
      charts.current.push(new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: persons.map(p => p.name),
          datasets: [
            { label: '총 활동', data: persons.map(p => p.count), backgroundColor: '#4f46e5', borderRadius: 6 },
            { label: '계약', data: persons.map(p => p.contract), backgroundColor: '#059669', borderRadius: 6 },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      }))

      // --- 활동 유형 분포 (Donut) ---
      const typeMap: Record<string, number> = {}
      for (const log of data) {
        for (const act of log.activities) {
          typeMap[act.activity_type] = (typeMap[act.activity_type] || 0) + 1
        }
      }
      const typeEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1])
      charts.current.push(new Chart(donutRef.current, {
        type: 'doughnut',
        data: {
          labels: typeEntries.map(([t]) => `${TYPE_STYLE[t]?.icon || ''} ${t}`),
          datasets: [{ data: typeEntries.map(([, v]) => v), backgroundColor: typeEntries.map(([t]) => TYPE_COLORS[t] || '#94a3b8'), borderWidth: 2 }],
        },
        options: { responsive: true, plugins: { legend: { position: 'right' } }, cutout: '60%' },
      }))

      // --- 일별 활동 추이 (Line) ---
      const daysInMonth = new Date(year, month, 0).getDate()
      const dayLabels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}일`)
      const dayMap: Record<string, number> = {}
      for (const log of data) {
        const day = parseInt(log.log_date.split('-')[2], 10)
        dayMap[day] = (dayMap[day] || 0) + log.activities.length
      }
      const dayData = Array.from({ length: daysInMonth }, (_, i) => dayMap[i + 1] || 0)
      charts.current.push(new Chart(lineRef.current, {
        type: 'line',
        data: {
          labels: dayLabels,
          datasets: [{ label: '일별 활동 건수', data: dayData, borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.08)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6 }],
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      }))
    }

    if ((window as any).Chart) { initCharts(); return }
    if (!document.getElementById('chartjs')) {
      const s = document.createElement('script')
      s.id = 'chartjs'; s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
      s.onload = initCharts; document.head.appendChild(s)
    } else {
      const t = setInterval(() => { if ((window as any).Chart) { clearInterval(t); initCharts() } }, 100)
    }
    return () => { charts.current.forEach(c => c?.destroy()); charts.current = [] }
  }, [data, year, month])

  // --- 요약 통계 계산 ---
  const personSummary: Record<string, { name: string; attendDays: number; total: number; visitMeet: number; callEmail: number; contract: number }> = {}
  for (const log of data) {
    const key = log.user_id
    const name = log.profiles?.name || log.profiles?.email || '미확인'
    if (!personSummary[key]) personSummary[key] = { name, attendDays: 0, total: 0, visitMeet: 0, callEmail: 0, contract: 0 }
    if (log.check_in_time) personSummary[key].attendDays++
    personSummary[key].total += log.activities.length
    personSummary[key].visitMeet += log.activities.filter((a: any) => ['방문', '미팅'].includes(a.activity_type)).length
    personSummary[key].callEmail += log.activities.filter((a: any) => ['전화', '이메일'].includes(a.activity_type)).length
    personSummary[key].contract += log.activities.filter((a: any) => a.activity_type === '계약').length
  }
  const rows = Object.values(personSummary)
  const totals = rows.reduce((acc, r) => ({ attendDays: acc.attendDays + r.attendDays, total: acc.total + r.total, visitMeet: acc.visitMeet + r.visitMeet, callEmail: acc.callEmail + r.callEmail, contract: acc.contract + r.contract }), { attendDays: 0, total: 0, visitMeet: 0, callEmail: 0, contract: 0 })

  return (
    <div id="report-content" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`@media print { body > * { display: none !important; } #report-print-root { display: block !important; } .no-print { display: none !important; } }`}</style>

      {/* 리포트 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', color: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>영업팀 월간 보고서</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{year}년 {month}월 영업 활동 종합</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>출력일: {toDateStr(new Date())}</div>
        </div>
        <button className="no-print" onClick={() => window.print()}
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '10px 20px', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          🖨️ PDF로 저장
        </button>
      </div>

      {/* 핵심 수치 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '총 출근일수', value: totals.attendDays, unit: '일', color: '#4f46e5', bg: '#eef2ff' },
          { label: '총 활동 건수', value: totals.total, unit: '건', color: '#0284c7', bg: '#f0f9ff' },
          { label: '방문 · 미팅', value: totals.visitMeet, unit: '건', color: '#7c3aed', bg: '#f5f3ff' },
          { label: '계약 성사', value: totals.contract, unit: '건', color: '#059669', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: s.color, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}<span style={{ fontSize: 16, marginLeft: 2 }}>{s.unit}</span></div>
          </div>
        ))}
      </div>

      {/* 차트 2열 */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>👤 담당자별 활동 건수</div>
          <canvas ref={barRef} />
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>📊 활동 유형 분포</div>
          <canvas ref={donutRef} />
        </div>
      </div>

      {/* 일별 추이 */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>📈 일별 활동 추이</div>
        <canvas ref={lineRef} />
      </div>

      {/* 담당자별 요약 테이블 */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>📋 담당자별 상세 현황</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['담당자', '출근일수', '총 활동', '방문/미팅', '전화/이메일', '계약', '활동/일(평균)'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => b.total - a.total).map((r, i) => (
              <tr key={r.name} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: MEMBER_COLORS[i % MEMBER_COLORS.length], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, marginRight: 8 }}>{r.name.charAt(0)}</span>
                  {r.name}
                </td>
                {[r.attendDays, r.total, r.visitMeet, r.callEmail, r.contract].map((v, j) => (
                  <td key={j} style={{ padding: '10px 12px', textAlign: 'center', color: v === 0 ? '#cbd5e1' : '#1e293b', fontWeight: v > 0 ? 600 : 400, borderBottom: '1px solid #f1f5f9' }}>{v}</td>
                ))}
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#4f46e5', fontWeight: 700, borderBottom: '1px solid #f1f5f9' }}>
                  {r.attendDays > 0 ? (r.total / r.attendDays).toFixed(1) : '-'}
                </td>
              </tr>
            ))}
            <tr style={{ background: '#f0f9ff', fontWeight: 700 }}>
              <td style={{ padding: '10px 12px', color: '#0284c7', fontWeight: 800 }}>합계</td>
              {[totals.attendDays, totals.total, totals.visitMeet, totals.callEmail, totals.contract].map((v, j) => (
                <td key={j} style={{ padding: '10px 12px', textAlign: 'center', color: '#0284c7' }}>{v}</td>
              ))}
              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0284c7' }}>
                {totals.attendDays > 0 ? (totals.total / totals.attendDays).toFixed(1) : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminMap({ members }: { members: MemberData[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const initMap = () => {
      const L = (window as any).L
      if (!mapRef.current) return
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
      const map = L.map(mapRef.current).setView([37.5665, 126.9780], 11)
      mapInstanceRef.current = map
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
      }).addTo(map)

      const allPts: [number, number][] = []

      members.forEach(({ log, activities, color }) => {
        const name = (log as any).profiles?.name || (log as any).profiles?.email || '미확인'
        const pts: Array<{ lat: number; lng: number; label: string; popup: string }> = []

        if (log.check_in_lat && log.check_in_lng) {
          pts.push({
            lat: log.check_in_lat, lng: log.check_in_lng,
            label: '🏢',
            popup: `<div style="font-family:system-ui;font-size:13px;min-width:160px">
              <div style="font-weight:700;color:${color};margin-bottom:4px">${name}</div>
              <div>⏰ ${log.check_in_time} 출근</div>
              <div style="color:#64748b;font-size:12px">📍 ${log.check_in_address}</div>
            </div>`,
          })
        }

        activities.filter(a => a.lat && a.lng).forEach((a, i) => {
          const s = TYPE_STYLE[a.activity_type] || TYPE_STYLE['기타']
          pts.push({
            lat: a.lat!, lng: a.lng!,
            label: String(i + 1),
            popup: `<div style="font-family:system-ui;font-size:13px;min-width:180px">
              <div style="font-weight:700;color:${color};margin-bottom:4px">${name}</div>
              <div>${a.activity_time}${a.end_time ? '~' + a.end_time : ''} <span style="background:${s.bg};color:${s.text};border-radius:10px;padding:1px 7px;font-size:11px">${s.icon} ${a.activity_type}</span></div>
              ${a.company ? `<div style="font-weight:600;margin-top:2px">${a.company}</div>` : ''}
              ${a.address ? `<div style="color:#64748b;font-size:12px">📍 ${a.address}</div>` : ''}
              ${a.content ? `<div style="font-size:12px;margin-top:4px">${a.content}</div>` : ''}
              ${a.result ? `<div style="color:#059669;font-size:12px">✅ ${a.result}</div>` : ''}
            </div>`,
          })
        })

        if (pts.length === 0) return

        pts.forEach(p => allPts.push([p.lat, p.lng]))

        if (pts.length > 1) {
          L.polyline(pts.map(p => [p.lat, p.lng]), { color, weight: 3, opacity: 0.7 }).addTo(map)
        }

        pts.forEach((p, i) => {
          const isCheckIn = i === 0 && p.label === '🏢'
          const icon = L.divIcon({
            className: '',
            html: `<div style="background:${isCheckIn ? color : color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${isCheckIn ? '14px' : '12px'};font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)">${p.label}</div>`,
            iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -18],
          })
          L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(p.popup, { maxWidth: 240 })
        })
      })

      if (allPts.length > 0) {
        map.fitBounds(L.latLngBounds(allPts), { padding: [50, 50] })
      }
    }

    if ((window as any).L) { initMap(); return }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script')
      script.id = 'leaflet-js'
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = initMap
      document.head.appendChild(script)
    } else {
      const wait = setInterval(() => { if ((window as any).L) { clearInterval(wait); initMap() } }, 100)
    }
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [members])

  return <div ref={mapRef} style={{ height: 420, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }} />
}

export default function AdminPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [members, setMembers] = useState<MemberData[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'users' | 'export' | 'report'>('list')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [users, setUsers] = useState<Profile[]>([])
  const [userForm, setUserForm] = useState({ email: '', password: '', name: '', role: 'member' })
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState({ name: '', role: 'member', password: '' })
  const [userLoading, setUserLoading] = useState(false)
  const [userMsg, setUserMsg] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [exportStart, setExportStart] = useState(() => {
    const d = new Date(); d.setDate(1); return toDateStr(d)
  })
  const [exportEnd, setExportEnd] = useState(toDateStr(new Date()))
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportData, setReportData] = useState<any[]>([])
  const [reportLoading, setReportLoading] = useState(false)

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    const logs = await getAllLogsForDate(date)
    const memberLogs = logs.filter(l => (l as any).profiles)
    const acts = await getActivitiesByLogIds(memberLogs.map(l => l.id))
    const data: MemberData[] = memberLogs.map((log, i) => ({
      log: log as any,
      activities: acts.filter(a => a.log_id === log.id),
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    }))
    setMembers(data)
    setLoading(false)
  }, [])

  const loadUsers = useCallback(async (token: string) => {
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setUsers(await res.json())
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return }
      const p = await getProfile(data.session.user.id)
      if (!p || (p.role !== 'admin' && p.role !== 'owner')) { router.push('/dashboard'); return }
      setProfile(p)
      await Promise.all([loadData(selectedDate), loadUsers(data.session.access_token)])
    })
  }, [router, loadData, loadUsers, selectedDate])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setUserLoading(true); setUserMsg('')
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm),
    })
    const data = await res.json()
    if (res.ok) {
      setUserMsg('✅ 계정이 생성됐습니다.')
      setUserForm({ email: '', password: '', name: '', role: 'member' })
      await loadUsers(token)
    } else {
      setUserMsg(`❌ ${data.error}`)
    }
    setUserLoading(false)
  }

  async function handleCreateLink() {
    if (!userForm.email) { setUserMsg('❌ 이메일을 입력하세요'); return }
    setUserLoading(true); setUserMsg('')
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userForm, linkOnly: true }),
    })
    const data = await res.json()
    if (res.ok && data.inviteLink) {
      setInviteLink(data.inviteLink)
      setUserForm({ email: '', password: '', name: '', role: 'member' })
      await loadUsers(token)
      setUserMsg('✅ 링크 생성 완료! 아래 링크를 카톡으로 전달하세요.')
    } else {
      setUserMsg(`❌ ${data.error}`)
    }
    setUserLoading(false)
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setUserLoading(true); setUserMsg('')
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editUser.id, ...editForm }),
    })
    if (res.ok) {
      setUserMsg('✅ 수정됐습니다.')
      setEditUser(null)
      await loadUsers(token)
    } else {
      const d = await res.json()
      setUserMsg(`❌ ${d.error}`)
    }
    setUserLoading(false)
  }

  async function handleDeleteUser(id: string, name: string) {
    if (!confirm(`${name} 계정을 삭제하시겠습니까?\n모든 데이터가 함께 삭제됩니다.`)) return
    const token = await getToken()
    await fetch('/api/admin/users', {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setUserMsg('✅ 삭제됐습니다.')
    await loadUsers(token)
  }

  async function loadReport(y: number, m: number) {
    setReportLoading(true)
    const token = await getToken()
    const start = `${y}-${String(m).padStart(2,'0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    const res = await fetch(`/api/admin/export?start=${start}&end=${end}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setReportData(await res.json())
    setReportLoading(false)
  }

  async function handleExport() {
    setExporting(true); setExportMsg('')
    const token = await getToken()
    const res = await fetch(`/api/admin/export?start=${exportStart}&end=${exportEnd}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) { setExportMsg('❌ 데이터 조회 실패'); setExporting(false); return }
    const data: any[] = await res.json()
    if (data.length === 0) { setExportMsg('⚠️ 해당 기간에 데이터가 없습니다'); setExporting(false); return }

    const escape = (v: any) => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }

    const headers = ['날짜','담당자명','이메일','출근시간','출근위치','활동시간','종료시간','활동유형','업체명','담당자(거래처)','주소','활동내용','결과','다음행동예정']
    const rows: string[][] = []

    for (const log of data) {
      const name = log.profiles?.name || ''
      const email = log.profiles?.email || ''
      if (log.activities.length === 0) {
        rows.push([log.log_date, name, email, log.check_in_time || '', log.check_in_address || '', '', '', '', '', '', '', '', '', ''])
      } else {
        for (const act of log.activities) {
          rows.push([
            log.log_date, name, email,
            log.check_in_time || '', log.check_in_address || '',
            act.activity_time || '', act.end_time || '', act.activity_type || '',
            act.company || '', act.contact || '', act.address || '',
            act.content || '', act.result || '', act.next_action || '',
          ])
        }
      }
    }

    const csv = '﻿' + [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `영업일지_${exportStart}_${exportEnd}.csv`
    a.click(); URL.revokeObjectURL(url)
    setExportMsg(`✅ ${rows.length}행 다운로드 완료`)
    setExporting(false)
  }

  const checkedIn = members.filter(m => m.log.check_in_time).length
  const totalActs = members.reduce((s, m) => s + m.activities.length, 0)
  const contracts = members.reduce((s, m) => s + m.activities.filter(a => a.activity_type === '계약').length, 0)

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#64748b' }}>로딩 중...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#0f172a', color: '#fff', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 10px', fontSize: 20 }}>👑</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>관리자 대시보드</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>영업팀 전체 현황</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 14 }} />
          <button onClick={() => router.push('/dashboard')} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>내 일지</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>로그아웃</button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {/* 요약 스탯 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: '총 인원', value: `${members.length}명`, sub: '등록된 영업사원', color: '#4f46e5', bg: '#eef2ff' },
            { label: '출근 완료', value: `${checkedIn}명`, sub: `미출근 ${members.length - checkedIn}명`, color: '#059669', bg: '#f0fdf4' },
            { label: '총 활동', value: `${totalActs}건`, sub: '오늘 전체', color: '#0284c7', bg: '#f0f9ff' },
            { label: '계약', value: `${contracts}건`, sub: '오늘 성사', color: '#d97706', bg: '#fffbeb' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.bg}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([['list','👥 팀원 현황'],['map','🗺️ 이동 경로'],['report','📊 월간 리포트'],['users','⚙️ 계정 관리'],['export','📥 내보내기']] as const).map(([m, label]) => (
            <button key={m} onClick={() => { setViewMode(m); setUserMsg('') }} style={{ padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: viewMode === m ? '#0f172a' : '#f1f5f9', color: viewMode === m ? '#fff' : '#64748b' }}>{label}</button>
          ))}
        </div>

        {/* 월간 리포트 탭 */}
        {viewMode === 'report' && (
          <div>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px' }}>
              <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#1e293b' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#1e293b' }}>
                {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
              <button onClick={() => loadReport(reportYear, reportMonth)} disabled={reportLoading}
                style={{ background: '#0f172a', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {reportLoading ? '조회 중...' : '조회'}
              </button>
              {reportData.length === 0 && !reportLoading && (
                <span style={{ color: '#94a3b8', fontSize: 13 }}>월과 연도를 선택 후 조회하세요</span>
              )}
            </div>
            {reportLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>데이터 불러오는 중...</div>
            ) : reportData.length > 0 ? (
              <div id="report-print-root">
                <ReportView data={reportData} year={reportYear} month={reportMonth} />
              </div>
            ) : null}
          </div>
        )}

        {/* 내보내기 탭 */}
        {viewMode === 'export' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, maxWidth: 520 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, color: '#0f172a', marginBottom: 6 }}>📥 활동 데이터 내보내기</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>기간을 선택하면 모든 담당자의 일지와 활동 내역을 CSV 파일로 다운로드합니다.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569' }}>
                시작일
                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#1e293b' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569' }}>
                종료일
                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#1e293b' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { label: '이번 달', fn: () => { const d = new Date(); d.setDate(1); setExportStart(toDateStr(d)); setExportEnd(toDateStr(new Date())) } },
                { label: '지난 달', fn: () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); setExportStart(toDateStr(d)); setExportEnd(toDateStr(e)) } },
                { label: '최근 7일', fn: () => { const d = new Date(); d.setDate(d.getDate() - 6); setExportStart(toDateStr(d)); setExportEnd(toDateStr(new Date())) } },
                { label: '최근 30일', fn: () => { const d = new Date(); d.setDate(d.getDate() - 29); setExportStart(toDateStr(d)); setExportEnd(toDateStr(new Date())) } },
              ].map(b => (
                <button key={b.label} onClick={b.fn} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{b.label}</button>
              ))}
            </div>
            {exportMsg && <p style={{ fontSize: 13, color: exportMsg.startsWith('✅') ? '#059669' : exportMsg.startsWith('⚠️') ? '#d97706' : '#dc2626', marginBottom: 12 }}>{exportMsg}</p>}
            <button onClick={handleExport} disabled={exporting} style={{ width: '100%', background: '#0f172a', border: 'none', borderRadius: 10, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 15, cursor: exporting ? 'wait' : 'pointer' }}>
              {exporting ? '⏳ 데이터 조회 중...' : '📥 CSV 다운로드'}
            </button>
            <div style={{ marginTop: 20, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, color: '#64748b', lineHeight: 1.9 }}>
              <b style={{ color: '#475569' }}>CSV 파일 포함 항목</b><br />
              날짜 · 담당자명 · 이메일 · 출근시간 · 출근위치<br />
              활동시간 · 종료시간 · 활동유형 · 업체명 · 담당자(거래처)<br />
              주소 · 활동내용 · 결과 · 다음행동예정<br />
              <span style={{ color: '#94a3b8' }}>※ Excel에서 열면 자동으로 표 형식으로 정렬됩니다</span>
            </div>
          </div>
        )}

        {/* 계정 관리 탭 */}
        {viewMode === 'users' && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
            {/* 계정 생성 */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 16 }}>➕ 새 계정 등록</h3>
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: '이름', key: 'name', type: 'text', placeholder: '홍길동' },
                  { label: '이메일 *', key: 'email', type: 'email', placeholder: 'user@company.com' },
                ].map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    {f.label}
                    <input type={f.type} placeholder={f.placeholder} value={(userForm as any)[f.key]}
                      onChange={e => setUserForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#1e293b' }} />
                  </label>
                ))}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  권한
                  <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#1e293b' }}>
                    <option value="member">담당자</option>
                    <option value="admin">관리자</option>
                    {profile.role === 'owner' && <option value="owner">프로그램 관리자</option>}
                  </select>
                </label>
                {userMsg && <p style={{ fontSize: 13, color: userMsg.startsWith('✅') ? '#059669' : '#dc2626' }}>{userMsg}</p>}
                <button type="button" onClick={handleCreateLink} disabled={userLoading} style={{ background: '#f59e0b', border: 'none', borderRadius: 10, padding: '12px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  {userLoading ? '처리 중...' : '🔗 카톡 초대 링크 생성'}
                </button>
                <button type="submit" disabled={userLoading} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {userLoading ? '처리 중...' : '📧 메일 발송 (회사메일 차단될 수 있음)'}
                </button>
              </form>
              {inviteLink && (
                <div style={{ marginTop: 12, padding: 14, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>📲 아래 링크를 카톡으로 전달하세요 (24시간 유효)</div>
                  <div style={{ fontSize: 11, color: '#78350f', background: '#fff', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 10px', wordBreak: 'break-all', marginBottom: 8 }}>
                    {inviteLink}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(inviteLink); setUserMsg('✅ 링크 복사됨! 카톡에 붙여넣기 하세요.'); }} style={{ background: '#f59e0b', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%' }}>
                    📋 링크 복사
                  </button>
                </div>
              )}
              {/* 앱 주소 공유 */}
              <div style={{ marginTop: 16, padding: 16, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>📲 앱 주소 카톡으로 공유</div>
                <div style={{ fontSize: 11, color: '#0284c7', marginBottom: 10, lineHeight: 1.7 }}>
                  1. 아래 주소 복사 → 카톡으로 전송<br />
                  2. 담당자가 주소 접속 → 로그인 화면<br />
                  3. <b>비밀번호를 모르시나요?</b> 클릭<br />
                  4. 이메일 입력 → 비밀번호 설정 메일 발송<br />
                  5. 메일 링크 클릭 → 비밀번호 직접 설정
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: '#fff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login'}
                  </div>
                  <button onClick={() => {
                    const url = `${window.location.origin}/login`
                    navigator.clipboard.writeText(url).then(() => {
                      setUserMsg('✅ 주소가 복사됐습니다! 카톡에 붙여넣기 하세요.')
                      setTimeout(() => setUserMsg(''), 3000)
                    })
                  }} style={{ background: '#0284c7', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    🔗 복사
                  </button>
                </div>
              </div>
            </div>

            {/* 계정 목록 */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 16 }}>👤 등록된 계정 ({users.length}명)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {users.map(u => (
                  <div key={u.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                    {editUser?.id === u.id ? (
                      <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <input placeholder="이름" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} style={iStyle} />
                        </div>
                        <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} style={iStyle}>
                          <option value="member">담당자</option>
                          <option value="admin">관리자</option>
                          {profile.role === 'owner' && <option value="owner">프로그램 관리자</option>}
                        </select>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="submit" disabled={userLoading} style={{ flex: 1, background: '#4f46e5', border: 'none', borderRadius: 8, padding: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>저장</button>
                          <button type="button" onClick={() => setEditUser(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>취소</button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.role === 'admin' ? '#f59e0b' : '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                          {(u.name || u.email).charAt(0)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{u.name || '(이름 없음)'}</span>
                            <span style={{
                              background: u.role === 'owner' ? '#fef3c7' : u.role === 'admin' ? '#eef2ff' : '#f1f5f9',
                              color: u.role === 'owner' ? '#b45309' : u.role === 'admin' ? '#4338ca' : '#64748b',
                              borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600
                            }}>
                              {u.role === 'owner' ? '⭐ 프로그램 관리자' : u.role === 'admin' ? '👑 관리자' : '담당자'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{u.email}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditUser(u); setEditForm({ name: u.name || '', role: u.role, password: '' }); setUserMsg('') }}
                            style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#475569' }}>수정</button>
                          <button onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>삭제</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading && viewMode !== 'users' && viewMode !== 'export' && viewMode !== 'report' ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>불러오는 중...</div>
        ) : viewMode !== 'users' && viewMode !== 'export' && viewMode !== 'report' && members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
            <p style={{ fontSize: 36 }}>📋</p>
            <p style={{ marginTop: 8 }}>이 날짜에 등록된 활동이 없습니다</p>
          </div>
        ) : viewMode === 'export' || viewMode === 'report' ? null : viewMode === 'map' ? (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>담당자 선택</span>
              <select
                value={selectedMemberIds.size === 0 ? '__all__' : [...selectedMemberIds][0]}
                onChange={e => {
                  const v = e.target.value
                  setSelectedMemberIds(v === '__all__' ? new Set() : new Set([v]))
                }}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 14, color: '#1e293b', minWidth: 180, cursor: 'pointer' }}>
                <option value="__all__">전체 보기</option>
                {members.map(m => {
                  const id = m.log.user_id
                  const name = (m.log as any).profiles?.name || (m.log as any).profiles?.email || '미확인'
                  return (
                    <option key={id} value={id}>
                      {name} ({m.activities.length}건{m.log.check_in_time ? ` · 출근 ${m.log.check_in_time}` : ' · 미출근'})
                    </option>
                  )
                })}
              </select>
              {selectedMemberIds.size > 0 && (() => {
                const m = members.find(x => selectedMemberIds.has(x.log.user_id))
                if (!m) return null
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '6px 14px', fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color }} />
                    <span style={{ fontWeight: 600, color: '#0369a1' }}>{(m.log as any).profiles?.name || '미확인'}</span>
                    <span style={{ color: '#64748b' }}>활동 {m.activities.length}건</span>
                    {m.log.check_in_time && <span style={{ color: '#059669' }}>✓ {m.log.check_in_time} 출근</span>}
                  </div>
                )
              })()}
            </div>
            <AdminMap members={selectedMemberIds.size === 0 ? members : members.filter(m => selectedMemberIds.has(m.log.user_id))} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {members.map(m => {
              const name = (m.log as any).profiles?.name || (m.log as any).profiles?.email || '미확인'
              const isOpen = expanded === m.log.id
              const visits = m.activities.filter(a => ['방문', '미팅'].includes(a.activity_type)).length
              return (
                <div key={m.log.id} style={{ background: '#fff', border: `1px solid ${isOpen ? m.color : '#e2e8f0'}`, borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                  {/* 헤더 */}
                  <div onClick={() => setExpanded(isOpen ? null : m.log.id)} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: m.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{name}</span>
                        {m.log.is_working
                          ? <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>근무중</span>
                          : <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>휴무</span>
                        }
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
                        {m.log.check_in_time
                          ? <span style={{ color: '#059669' }}>✅ {m.log.check_in_time} 출근 · {m.log.check_in_address}</span>
                          : <span style={{ color: '#94a3b8' }}>⏳ 미출근</span>
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, textAlign: 'center' }}>
                      {[
                        { v: m.activities.length, l: '활동' },
                        { v: visits, l: '방문/미팅' },
                        { v: m.activities.filter(a => a.activity_type === '계약').length, l: '계약' },
                      ].map(s => (
                        <div key={s.l}>
                          <div style={{ fontWeight: 700, fontSize: 18, color: m.color }}>{s.v}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* 활동 목록 */}
                  {isOpen && (
                    <div style={{ borderTop: `2px solid ${m.color}`, padding: '16px 20px', background: '#fafafa' }}>
                      {m.activities.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>등록된 활동이 없습니다</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {[...m.activities].sort((a, b) => a.activity_time.localeCompare(b.activity_time)).map(act => {
                            const s = TYPE_STYLE[act.activity_type] || TYPE_STYLE['기타']
                            return (
                              <div key={act.id} style={{ display: 'flex', gap: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{act.activity_time}{act.end_time ? ` ~ ${act.end_time}` : ''}</span>
                                    <span style={{ background: s.bg, color: s.text, borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{act.activity_type}</span>
                                    {act.company && <span style={{ fontWeight: 600, color: '#334155', fontSize: 13 }}>{act.company}</span>}
                                  </div>
                                  {act.address && <div style={{ fontSize: 12, color: '#64748b' }}>📍 {act.address}</div>}
                                  {act.content && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{act.content}</div>}
                                  {act.result && <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>✅ {act.result}</div>}
                                  {act.next_action && <div style={{ fontSize: 12, color: '#4338ca', marginTop: 2 }}>➡️ {act.next_action}</div>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
