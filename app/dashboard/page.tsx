'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getOrCreateLog, getActivities, saveActivity, deleteActivity, updateLogSummary, updateLogWorking, getProfile } from '@/lib/supabase'
import type { Activity, SalesLog, Profile } from '@/lib/supabase'

const ACTIVITY_TYPES = ['방문', '전화', '미팅', '이메일', '제안', '계약', '기타']

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [log, setLog] = useState<SalesLog | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [form, setForm] = useState({
    activity_time: '', activity_type: '방문', company: '', contact: '', content: '', result: '', lat: '', lng: '',
  })

  const load = useCallback(async (userId: string, date: string) => {
    const l = await getOrCreateLog(userId, date)
    setLog(l)
    if (l) {
      const acts = await getActivities(l.id)
      setActivities(acts)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return }
      try {
        const p = await getProfile(data.session.user.id)
        if (!p) { router.push('/login'); return }
        setProfile(p)
        await load(data.session.user.id, selectedDate)
      } catch {
        router.push('/login')
      }
    }).catch(() => router.push('/login'))
  }, [router, load, selectedDate])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!log || !profile) return
    await saveActivity({
      log_id: log.id, user_id: profile.id,
      activity_time: form.activity_time, activity_type: form.activity_type,
      company: form.company || null, contact: form.contact || null,
      content: form.content || null, result: form.result || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
    })
    setForm({ activity_time: '', activity_type: '방문', company: '', contact: '', content: '', result: '', lat: '', lng: '' })
    setShowForm(false)
    await load(profile.id, selectedDate)
  }

  async function handleDelete(id: string) {
    if (deleteTarget === id) {
      await deleteActivity(id)
      setDeleteTarget(null)
      if (profile) await load(profile.id, selectedDate)
    } else {
      setDeleteTarget(id)
    }
  }

  async function handleToggleWorking() {
    if (!log) return
    const next = !log.is_working
    await updateLogWorking(log.id, next)
    setLog(prev => prev ? { ...prev, is_working: next } : prev)
  }

  async function handleSummary() {
    if (!log) return
    const text = activities.map(a =>
      `${a.activity_time} [${a.activity_type}] ${a.company ?? ''} ${a.contact ?? ''}: ${a.content ?? ''} → ${a.result ?? ''}`
    ).join('\n')
    await updateLogSummary(log.id, `총 ${activities.length}건 활동\n${text}`)
    alert('요약이 저장되었습니다.')
  }

  const sorted = [...activities].sort((a, b) => a.activity_time.localeCompare(b.activity_time))

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>로딩 중...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <header style={{ background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#4fc3f7' }}>영업활동일지</h1>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 14 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
            {profile.name || profile.email}
            {profile.role === 'admin' && <span style={{ marginLeft: 6, background: '#f59e0b', color: '#000', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>관리자</span>}
          </span>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>로그아웃</button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: '총 활동', value: activities.length + '건' },
            { label: '방문', value: activities.filter(a => a.activity_type === '방문').length + '건' },
            { label: '계약', value: activities.filter(a => a.activity_type === '계약').length + '건' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#4fc3f7' }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>타임라인</h2>
            {log && (
              <button onClick={handleToggleWorking} style={{
                background: log.is_working ? 'rgba(129,199,132,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${log.is_working ? 'rgba(129,199,132,0.4)' : 'rgba(239,68,68,0.4)'}`,
                borderRadius: 20, padding: '4px 14px', color: log.is_working ? '#81c784' : '#ef4444',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
                {log.is_working ? '✓ 근무중' : '✕ 휴무'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSummary} disabled={!log?.is_working} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 16px', color: '#f59e0b', cursor: log?.is_working ? 'pointer' : 'not-allowed', fontSize: 13, opacity: log?.is_working ? 1 : 0.4 }}>요약 저장</button>
            <button onClick={() => setShowForm(!showForm)} disabled={!log?.is_working} style={{ background: log?.is_working ? 'linear-gradient(135deg, #4fc3f7, #0288d1)' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: log?.is_working ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, opacity: log?.is_working ? 1 : 0.4 }}>+ 활동 추가</button>
          </div>
        </div>

        {log && !log.is_working && (
          <div style={{ textAlign: 'center', padding: '40px 0', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 20 }}>
            <p style={{ fontSize: 32 }}>🏖️</p>
            <p style={{ color: '#ef4444', fontWeight: 600, marginTop: 8 }}>휴무일</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>연차/공휴일로 설정되었습니다</p>
            <button onClick={handleToggleWorking} style={{ marginTop: 16, background: 'rgba(129,199,132,0.15)', border: '1px solid rgba(129,199,132,0.4)', borderRadius: 8, padding: '8px 20px', color: '#81c784', cursor: 'pointer', fontSize: 13 }}>근무로 변경</button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSave} style={{ background: 'rgba(79,195,247,0.05)', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 12, padding: 20, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={lblStyle}>시간 *<input type="time" required value={form.activity_time} onChange={e => setForm(p => ({ ...p, activity_time: e.target.value }))} style={inpStyle} /></label>
            <label style={lblStyle}>유형 *<select value={form.activity_type} onChange={e => setForm(p => ({ ...p, activity_type: e.target.value }))} style={inpStyle}>{ACTIVITY_TYPES.map(t => <option key={t} style={{ background: '#1a1a2e', color: '#fff' }}>{t}</option>)}</select></label>
            <label style={lblStyle}>거래처<input type="text" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} style={inpStyle} placeholder="회사명" /></label>
            <label style={lblStyle}>담당자<input type="text" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} style={inpStyle} placeholder="담당자명" /></label>
            <label style={{ ...lblStyle, gridColumn: '1/-1' }}>활동 내용<textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} style={{ ...inpStyle, height: 80, resize: 'vertical' }} placeholder="활동 내용 입력..." /></label>
            <label style={{ ...lblStyle, gridColumn: '1/-1' }}>결과<input type="text" value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))} style={inpStyle} placeholder="결과/후속조치" /></label>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 20px', color: '#fff', cursor: 'pointer' }}>취소</button>
              <button type="submit" style={{ background: 'linear-gradient(135deg, #4fc3f7, #0288d1)', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>저장</button>
            </div>
          </form>
        )}

        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontSize: 40 }}>📋</p>
            <p style={{ marginTop: 8 }}>오늘의 활동을 기록하세요</p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 59, top: 20, bottom: 20, width: 2, background: 'rgba(79,195,247,0.2)', zIndex: 0 }} />
            {sorted.map((act, idx) => {
              const typeColor: Record<string, string> = { '방문': '#4fc3f7', '전화': '#81c784', '미팅': '#ffb74d', '이메일': '#ce93d8', '제안': '#f48fb1', '계약': '#a5d6a7', '기타': '#90a4ae' }
              const color = typeColor[act.activity_type] || '#90a4ae'
              const isLast = idx === sorted.length - 1
              const timeDiff = isLast ? null : (() => {
                const [h1, m1] = sorted[idx + 1].activity_time.split(':').map(Number)
                const [h0, m0] = act.activity_time.split(':').map(Number)
                const diff = (h1 * 60 + m1) - (h0 * 60 + m0)
                return diff > 0 ? `${Math.floor(diff / 60) > 0 ? Math.floor(diff / 60) + '시간 ' : ''}${diff % 60}분 후` : null
              })()
              return (
                <div key={act.id} style={{ display: 'flex', gap: 16, marginBottom: 12, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 52, textAlign: 'right', flexShrink: 0, paddingTop: 16 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{act.activity_time.slice(0, 5)}</span>
                  </div>
                  <div style={{ width: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: color, border: '2px solid #0f172a', marginTop: 16, flexShrink: 0 }} />
                    {timeDiff && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4, whiteSpace: 'nowrap' }}>{timeDiff}</span>}
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ background: color + '22', color, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{act.activity_type}</span>
                        {act.company && <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 600 }}>{act.company}</span>}
                        {act.contact && <span style={{ marginLeft: 6, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>({act.contact})</span>}
                      </div>
                      <button onClick={() => handleDelete(act.id)} style={{ background: deleteTarget === act.id ? '#ef4444' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 8px', color: '#fff', cursor: 'pointer', fontSize: 11 }}>
                        {deleteTarget === act.id ? '확인' : '삭제'}
                      </button>
                    </div>
                    {act.content && <p style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{act.content}</p>}
                    {act.result && <p style={{ marginTop: 4, fontSize: 12, color: '#81c784' }}>→ {act.result}</p>}
                    {(act.lat && act.lng) && <p style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>📍 {act.lat.toFixed(4)}, {act.lng.toFixed(4)}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {log?.summary && (
          <div style={{ marginTop: 24, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 14, color: '#f59e0b', marginBottom: 8 }}>📝 저장된 요약</h3>
            <pre style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{log.summary}</pre>
          </div>
        )}
      </main>
    </div>
  )
}

const lblStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }
const inpStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none' }
