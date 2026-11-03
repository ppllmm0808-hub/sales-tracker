'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getOrCreateLog, getActivities, saveActivity, deleteActivity, updateActivity, updateLogSummary, updateLogWorking, checkInLog, getProfile } from '@/lib/supabase'
import type { Activity, SalesLog, Profile } from '@/lib/supabase'

const ACTIVITY_TYPES = ['내근', '이동', '미팅', '식사', '방문', '전화', '이메일', '제안', '계약', '기타']

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

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=kr`,
      { headers: { 'User-Agent': 'SalesTracker/1.0 (ppllmm0808@gmail.com)' } }
    )
    const data = await res.json()
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return null
}

function MapPanel({ activities }: { activities: Activity[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const withCoords = activities.filter(a => a.lat && a.lng)

  useEffect(() => {
    if (!mapRef.current) return
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const initMap = () => {
      const L = (window as any).L
      if (!mapRef.current) return
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
      const map = L.map(mapRef.current).setView([37.5665, 126.9780], 12)
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)
      const pts = activities.filter(a => a.lat && a.lng)
      if (pts.length > 0) {
        const bounds = L.latLngBounds(pts.map(a => [a.lat!, a.lng!]))
        map.fitBounds(bounds, { padding: [60, 60] })
        // 이동 경로 라인 (굵고 명확하게)
        if (pts.length > 1) {
          L.polyline(pts.map(a => [a.lat!, a.lng!]), {
            color: '#4f46e5', weight: 4, opacity: 0.8,
          }).addTo(map)
          // 방향 화살표 (중간 지점마다)
          for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i], p2 = pts[i + 1]
            const midLat = (p1.lat! + p2.lat!) / 2
            const midLng = (p1.lng! + p2.lng!) / 2
            const angle = Math.atan2(p2.lng! - p1.lng!, p2.lat! - p1.lat!) * 180 / Math.PI
            const arrowIcon = L.divIcon({
              className: '',
              html: `<div style="transform:rotate(${angle}deg);color:#4f46e5;font-size:18px;line-height:1;text-shadow:0 0 3px #fff">➤</div>`,
              iconSize: [20, 20], iconAnchor: [10, 10],
            })
            L.marker([midLat, midLng], { icon: arrowIcon }).addTo(map)
          }
        }
        // 활동 핀
        pts.forEach((act, i) => {
          const s = TYPE_STYLE[act.activity_type] || TYPE_STYLE['기타']
          const isFirst = i === 0, isLast = i === pts.length - 1
          const icon = L.divIcon({
            className: '',
            html: `<div style="position:relative">
              <div style="background:${isFirst ? '#059669' : isLast ? '#dc2626' : s.text};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.4);cursor:pointer">${i + 1}</div>
              ${isFirst ? '<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;white-space:nowrap">출발</div>' : ''}
              ${isLast ? '<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;white-space:nowrap">도착</div>' : ''}
            </div>`,
            iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -20],
          })
          L.marker([act.lat!, act.lng!], { icon }).addTo(map).bindPopup(`
            <div style="min-width:200px;font-family:system-ui;font-size:13px;line-height:1.5">
              <div style="font-weight:700;margin-bottom:6px;color:#1e293b;font-size:14px">${i + 1}. ${act.activity_time}${act.end_time ? ' ~ ' + act.end_time : ''}</div>
              <div style="display:inline-block;background:${s.bg};color:${s.text};border-radius:12px;padding:2px 8px;font-size:11px;font-weight:600;margin-bottom:6px">${s.icon} ${act.activity_type}</div>
              ${act.company ? `<div style="font-weight:600;color:#0f172a;font-size:14px">${act.company}</div>` : ''}
              ${act.address ? `<div style="color:#64748b;font-size:12px;margin-top:2px">📍 ${act.address}</div>` : ''}
              ${act.contact ? `<div style="color:#64748b;font-size:12px">👤 ${act.contact}</div>` : ''}
              ${act.content ? `<div style="margin-top:6px;color:#334155;font-size:12px;border-top:1px solid #f1f5f9;padding-top:6px">${act.content}</div>` : ''}
              ${act.result ? `<div style="color:#059669;margin-top:4px;font-size:12px">✅ ${act.result}</div>` : ''}
              ${act.next_action ? `<div style="color:#4338ca;margin-top:4px;font-size:12px">➡️ ${act.next_action}</div>` : ''}
            </div>
          `, { maxWidth: 260 })
        })
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
  }, [activities])

  if (withCoords.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
      <p style={{ fontSize: 40 }}>🗺️</p>
      <p style={{ marginTop: 8, fontWeight: 600, color: '#64748b' }}>지도에 표시할 위치가 없습니다</p>
      <p style={{ fontSize: 13, marginTop: 4 }}>활동 등록 시 주소를 입력하면 자동으로 지도에 표시됩니다</p>
    </div>
  )

  return (
    <div>
      <div ref={mapRef} style={{ height: 420, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }} />
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {withCoords.map((act, i) => {
          const s = TYPE_STYLE[act.activity_type] || TYPE_STYLE['기타']
          return (
            <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
              <span style={{ background: s.text, color: '#fff', width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ color: '#334155', fontWeight: 600 }}>{act.activity_time}</span>
              <span style={{ color: s.text, fontWeight: 600 }}>{act.activity_type}</span>
              <span style={{ color: '#64748b' }}>{act.company || act.address}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function calcWorkHours(acts: Activity[]) {
  if (!acts.length) return '0시간'
  const sorted = [...acts].sort((a, b) => a.activity_time.localeCompare(b.activity_time))
  const first = sorted[0].activity_time
  const lastAct = sorted[sorted.length - 1]
  const last = lastAct.end_time || lastAct.activity_time
  if (!first || !last) return '-'
  const [h1, m1] = first.split(':').map(Number)
  const [h2, m2] = last.split(':').map(Number)
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (mins <= 0) return '-'
  return `${Math.floor(mins / 60)}시간 ${mins % 60}분`
}

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [log, setLog] = useState<SalesLog | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Activity | null>(null)
  const [viewMode, setViewMode] = useState<'timeline' | 'map'>('timeline')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [formCoords, setFormCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [form, setForm] = useState({
    activity_time: '', end_time: '', activity_type: '미팅',
    company: '', contact: '', address: '', content: '', result: '', next_action: '',
  })

  const load = useCallback(async (userId: string, date: string) => {
    const l = await getOrCreateLog(userId, date)
    setLog(l)
    if (l) setActivities(await getActivities(l.id))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return }
      try {
        const p = await getProfile(data.session.user.id)
        if (!p) { router.push('/login'); return }
        setProfile(p)
        await load(data.session.user.id, selectedDate)
      } catch { router.push('/login') }
    }).catch(() => router.push('/login'))
  }, [router, load, selectedDate])

  function openAdd() {
    setEditTarget(null)
    setFormCoords(null)
    setForm({ activity_time: '', end_time: '', activity_type: '미팅', company: '', contact: '', address: '', content: '', result: '', next_action: '' })
    setShowModal(true)
  }

  function openEdit(act: Activity) {
    setEditTarget(act)
    setFormCoords(act.lat && act.lng ? { lat: act.lat, lng: act.lng } : null)
    setForm({
      activity_time: act.activity_time, end_time: act.end_time || '',
      activity_type: act.activity_type, company: act.company || '',
      contact: act.contact || '', address: act.address || '',
      content: act.content || '', result: act.result || '',
      next_action: act.next_action || '',
    })
    setShowModal(true)
  }

  async function captureGPS() {
    if (!navigator.geolocation) { alert('이 브라우저는 GPS를 지원하지 않습니다.'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      setFormCoords({ lat, lng })
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`, {
          headers: { 'User-Agent': 'SalesTracker/1.0' }
        })
        const data = await res.json()
        if (data?.display_name) {
          const addr = data.address
          const short = [addr?.road, addr?.quarter || addr?.suburb, addr?.city_district || addr?.borough].filter(Boolean).join(' ')
          setForm(p => ({ ...p, address: short || data.display_name.split(',').slice(0, 3).join(',').trim() }))
        }
      } catch {}
      setGpsLoading(false)
    }, (err) => {
      setGpsLoading(false)
      if (err.code === 1) alert('위치 권한을 허용해주세요.\n브라우저 주소창 왼쪽 자물쇠 아이콘을 클릭하세요.')
      else alert('GPS 위치를 가져올 수 없습니다.')
    }, { enableHighAccuracy: true, timeout: 10000 })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!log || !profile) return
    let coords: { lat: number; lng: number } | null = formCoords
    if (!coords && form.address) coords = await geocodeAddress(form.address)
    if (editTarget) {
      await updateActivity(editTarget.id, {
        activity_time: form.activity_time, end_time: form.end_time || null,
        activity_type: form.activity_type, company: form.company || null,
        contact: form.contact || null, address: form.address || null,
        content: form.content || null, result: form.result || null,
        next_action: form.next_action || null,
        ...(form.address ? { lat: coords?.lat ?? null, lng: coords?.lng ?? null } : {}),
      })
    } else {
      await saveActivity({
        log_id: log.id, user_id: profile.id,
        activity_time: form.activity_time, end_time: form.end_time || null,
        activity_type: form.activity_type, company: form.company || null,
        contact: form.contact || null, address: form.address || null,
        content: form.content || null, result: form.result || null,
        next_action: form.next_action || null,
        lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      })
    }
    setShowModal(false)
    await load(profile.id, selectedDate)
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await deleteActivity(id)
    if (profile) await load(profile.id, selectedDate)
  }

  async function handleCheckIn() {
    if (!log) return
    if (log.check_in_time && !confirm(`이미 ${log.check_in_time}에 체크인했습니다.\n다시 체크인 하시겠습니까?`)) return
    if (!navigator.geolocation) { alert('GPS를 지원하지 않는 브라우저입니다.'); return }
    setCheckInLoading(true)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      let address = `위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`, { headers: { 'User-Agent': 'SalesTracker/1.0' } })
        const data = await res.json()
        if (data?.address) {
          const a = data.address
          address = [a.road, a.quarter || a.suburb, a.city_district || a.borough, a.city || a.county].filter(Boolean).join(' ') || data.display_name.split(',').slice(0, 3).join(',').trim()
        }
      } catch {}
      await checkInLog(log.id, time, lat, lng, address)
      setLog(prev => prev ? { ...prev, check_in_time: time, check_in_lat: lat, check_in_lng: lng, check_in_address: address } : prev)
      setCheckInLoading(false)
      alert(`✅ 출근 체크인 완료!\n시간: ${time}\n위치: ${address}`)
    }, (err) => {
      setCheckInLoading(false)
      if (err.code === 1) alert('위치 권한을 허용해주세요.\n브라우저 주소창 왼쪽 자물쇠 아이콘을 클릭하세요.')
      else alert('GPS 위치를 가져올 수 없습니다.')
    }, { enableHighAccuracy: true, timeout: 10000 })
  }

  async function handleToggleWorking() {
    if (!log) return
    const next = !log.is_working
    await updateLogWorking(log.id, next)
    setLog(prev => prev ? { ...prev, is_working: next } : prev)
  }

  async function handleSummary() {
    if (!log) return
    const text = sorted.map(a =>
      `${a.activity_time}${a.end_time ? '~' + a.end_time : ''} [${a.activity_type}] ${a.company || ''} ${a.contact || ''}: ${a.content || ''} → ${a.result || ''}`
    ).join('\n')
    await updateLogSummary(log.id, `총 ${activities.length}건 활동\n${text}`)
    alert('요약이 저장되었습니다.')
  }

  function exportCSV() {
    const header = '시간,종료,유형,거래처,담당자,주소,내용,결과,다음액션'
    const rows = sorted.map(a =>
      [a.activity_time, a.end_time || '', a.activity_type, a.company || '', a.contact || '', a.address || '', a.content || '', a.result || '', a.next_action || ''].join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `영업일지_${selectedDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function copyToClipboard() {
    const text = sorted.map(a =>
      `${a.activity_time}${a.end_time ? '~' + a.end_time : ''}\t${a.activity_type}\t${a.company || ''}\t${a.address || ''}\t${a.content || ''}\t${a.result || ''}\t${a.next_action || ''}`
    ).join('\n')
    navigator.clipboard.writeText(text).then(() => alert('클립보드에 복사되었습니다.'))
  }

  const sorted = [...activities].sort((a, b) => a.activity_time.localeCompare(b.activity_time))
  const visitCount = activities.filter(a => ['방문', '미팅'].includes(a.activity_type)).length
  const workHours = calcWorkHours(activities)

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#64748b' }}>로딩 중...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#4f46e5', color: '#fff', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 10px', fontSize: 20 }}>💼</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>영업활동일지</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>8시간 타임라인 영업활동 자동화 시스템</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={exportCSV} style={headerBtn('#059669')}>📥 CSV</button>
          <button onClick={copyToClipboard} style={headerBtn('#0284c7')}>📋 복사</button>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginLeft: 8 }}>
            {profile.name || profile.email}
            {profile.role === 'admin' && <span style={{ marginLeft: 6, background: '#f59e0b', color: '#000', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>관리자</span>}
          </span>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>로그아웃</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Check-in Card */}
          <div style={{
            background: log?.check_in_time
              ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
              : 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
            borderRadius: 16, padding: 20, color: '#fff',
          }}>
            {log?.check_in_time ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>출근 완료</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{log.check_in_time} 체크인</div>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                  <div>📍 {log.check_in_address}</div>
                  {log.check_in_lat && log.check_in_lng && (
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>
                      GPS {log.check_in_lat.toFixed(5)}, {log.check_in_lng.toFixed(5)}
                    </div>
                  )}
                </div>
                <button onClick={handleCheckIn} disabled={checkInLoading} style={{ marginTop: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                  🔄 재체크인
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>📍</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>출근 체크인</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>GPS로 현재 위치를 기록하세요</div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 12 }}>
                  사무실이든 거래처든 어디서나 체크인 가능.<br />위치 + 시간이 자동 기록됩니다.
                </p>
                <button onClick={handleCheckIn} disabled={checkInLoading || !log?.is_working} style={{
                  width: '100%', background: checkInLoading ? 'rgba(255,255,255,0.2)' : '#fff',
                  border: 'none', borderRadius: 10, padding: '12px',
                  color: '#1e40af', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {checkInLoading ? '📡 GPS 위치 확인 중...' : '📍 지금 출근 체크인'}
                </button>
              </div>
            )}
          </div>

          {/* Date & Status */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📅</span>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                  style={{ fontWeight: 600, fontSize: 14, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px' }} />
              </div>
              {log && (
                <button onClick={handleToggleWorking} style={{
                  background: log.is_working ? '#dcfce7' : '#fee2e2',
                  color: log.is_working ? '#15803d' : '#dc2626',
                  border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: log.is_working ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                  {log.is_working ? '근무 진행중' : '휴무'}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={statBox('#f8fafc', '#64748b', '#1e293b')}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>총 근무 시간</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{workHours}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>목표: 09:00~18:00</div>
              </div>
              <div style={statBox('#eef2ff', '#4f46e5', '#312e81')}>
                <div style={{ fontSize: 11, color: '#4f46e5', marginBottom: 2 }}>총 활동</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#312e81' }}>{activities.length}건</div>
                <div style={{ fontSize: 10, color: '#818cf8', marginTop: 2 }}>오늘 기록</div>
              </div>
              <div style={statBox('#ecfdf5', '#059669', '#064e3b')}>
                <div style={{ fontSize: 11, color: '#059669', marginBottom: 2 }}>방문/미팅</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#064e3b' }}>{visitCount}곳</div>
                <div style={{ fontSize: 10, color: '#34d399', marginTop: 2 }}>대면 협의</div>
              </div>
              <div style={statBox('#fffbeb', '#b45309', '#78350f')}>
                <div style={{ fontSize: 11, color: '#b45309', marginBottom: 2 }}>계약</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#78350f' }}>{activities.filter(a => a.activity_type === '계약').length}건</div>
                <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 2 }}>성사 건수</div>
              </div>
            </div>
          </div>

          {/* Add Button */}
          <button onClick={openAdd} disabled={!log?.is_working} style={{
            background: log?.is_working ? '#4f46e5' : '#94a3b8',
            color: '#fff', border: 'none', borderRadius: 12, padding: '14px',
            fontSize: 15, fontWeight: 600, cursor: log?.is_working ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: log?.is_working ? '0 4px 12px rgba(79,70,229,0.3)' : 'none',
          }}>
            ➕ 새 영업 활동 추가
          </button>

          {/* Summary Box */}
          <div style={{ background: 'linear-gradient(135deg, #312e81 0%, #0f172a 100%)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 700, fontSize: 14 }}>
                🤖 일일 요약 리포트
              </div>
              <button onClick={handleSummary} disabled={!log?.is_working} style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(129,140,248,0.4)', borderRadius: 6, padding: '4px 10px', color: '#c7d2fe', fontSize: 12, cursor: 'pointer' }}>요약 저장</button>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.1)', minHeight: 80 }}>
              {log?.summary ? (
                <pre style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>{log.summary}</pre>
              ) : (
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>활동 내역을 등록한 후 [요약 저장] 버튼을 누르면 오늘의 영업활동을 정리합니다.</p>
              )}
            </div>
          </div>

          {/* Clipboard */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#334155', marginBottom: 8 }}>
              📊 구글 스프레드시트 복사
            </div>
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 12 }}>
              클릭 한 번으로 타임라인 전체 내용을 탭 구분 텍스트로 복사하여 엑셀/스프레드시트에 바로 붙여넣을 수 있습니다.
            </p>
            <button onClick={copyToClipboard} style={{ width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              📋 클립보드에 일지 복사하기
            </button>
          </div>
        </div>

        {/* Right Column: Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <button onClick={() => setViewMode('timeline')} style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: viewMode === 'timeline' ? '#4f46e5' : '#f1f5f9',
                  color: viewMode === 'timeline' ? '#fff' : '#64748b',
                }}>📋 타임라인</button>
                <button onClick={() => setViewMode('map')} style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: viewMode === 'map' ? '#4f46e5' : '#f1f5f9',
                  color: viewMode === 'map' ? '#fff' : '#64748b',
                }}>
                  🗺️ 지도
                  {activities.filter(a => a.lat && a.lng).length > 0 &&
                    <span style={{ marginLeft: 6, background: '#22c55e', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                      {activities.filter(a => a.lat && a.lng).length}
                    </span>
                  }
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {viewMode === 'timeline' ? '시간대별 활동 내역을 순서대로 관리합니다.' : '오늘의 영업 이동 경로 · 핀을 클릭하면 상세 정보가 표시됩니다.'}
              </div>
            </div>
            <button onClick={async () => {
              if (!confirm('전체 삭제하시겠습니까?')) return
              await Promise.all(activities.map(a => deleteActivity(a.id)))
              if (profile) await load(profile.id, selectedDate)
            }} style={{ color: '#e11d48', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              🗑️ 전체 삭제
            </button>
          </div>

          {/* Map View */}
          {viewMode === 'map' && log?.is_working && (
            <div style={card}>
              <MapPanel activities={sorted} />
            </div>
          )}

          {viewMode === 'timeline' && !log?.is_working && (
            <div style={{ textAlign: 'center', padding: '40px 0', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16 }}>
              <p style={{ fontSize: 32 }}>🏖️</p>
              <p style={{ color: '#dc2626', fontWeight: 600, marginTop: 8 }}>휴무일</p>
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>연차/공휴일로 설정되었습니다</p>
              <button onClick={handleToggleWorking} style={{ marginTop: 12, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '8px 20px', color: '#15803d', cursor: 'pointer', fontSize: 13 }}>근무로 변경</button>
            </div>
          )}

          {viewMode === 'timeline' && log?.is_working && sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <p style={{ fontSize: 40 }}>📋</p>
              <p style={{ marginTop: 8 }}>오늘의 활동을 기록하세요</p>
            </div>
          )}

          {viewMode === 'timeline' && log?.is_working && sorted.map((act) => {
            const style = TYPE_STYLE[act.activity_type] || TYPE_STYLE['기타']
            return (
              <div key={act.id} style={{ ...card, display: 'flex', gap: 16 }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: style.bg, color: style.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                    {style.icon}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                        {act.activity_time}{act.end_time ? ` ~ ${act.end_time}` : ''}
                      </span>
                      <span style={{ background: style.bg, color: style.text, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{act.activity_type}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(act)} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>✏️</button>
                      <button onClick={() => handleDelete(act.id)} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>🗑️</button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{act.company || '-'}</div>
                    {act.address && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📍 {act.address}</div>}
                    {act.contact && <div style={{ fontSize: 12, color: '#64748b' }}>👤 {act.contact}</div>}
                  </div>

                  {act.content && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#334155', lineHeight: 1.5, marginBottom: 8 }}>
                      {act.content}
                    </div>
                  )}
                  {act.result && <div style={{ fontSize: 12, color: '#059669', marginBottom: 4 }}>✅ 결과: {act.result}</div>}
                  {act.next_action && (
                    <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#4338ca', display: 'flex', alignItems: 'center', gap: 6 }}>
                      ➡️ <b>다음 액션:</b> {act.next_action}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 520, overflow: 'hidden' }}>
            <div style={{ background: '#4f46e5', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>💼 {editTarget ? '영업 활동 수정' : '영업 활동 등록'}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label style={lbl}>시작 시간 *<input type="time" required value={form.activity_time} onChange={e => setForm(p => ({ ...p, activity_time: e.target.value }))} style={inp} /></label>
              <label style={lbl}>종료 시간<input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={inp} /></label>
              <label style={lbl}>활동 구분 *
                <select value={form.activity_type} onChange={e => setForm(p => ({ ...p, activity_type: e.target.value }))} style={inp}>
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{TYPE_STYLE[t]?.icon} {t}</option>)}
                </select>
              </label>
              <label style={lbl}>거래처 / 방문지명<input type="text" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} style={inp} placeholder="거래처명 또는 방문 장소" /></label>
              <label style={{ ...lbl, gridColumn: '1/-1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>방문 위치 (주소/도시명)</span>
                  <button type="button" onClick={captureGPS} disabled={gpsLoading} style={{
                    background: 'none', border: 'none', padding: '2px 0',
                    color: formCoords ? '#15803d' : '#4338ca', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {gpsLoading ? '📡 위치 확인 중...' : formCoords ? `✅ GPS (${formCoords.lat.toFixed(4)}, ${formCoords.lng.toFixed(4)})` : '📍 GPS 현재 위치'}
                  </button>
                </div>
                <input type="text" value={form.address} onChange={e => { setForm(p => ({ ...p, address: e.target.value })); setFormCoords(null) }} style={inp} placeholder="주소 직접 입력 또는 GPS 버튼으로 자동 입력" />
              </label>
              <label style={{ ...lbl, gridColumn: '1/-1' }}>주요 활동 내용<textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} style={{ ...inp, height: 90, resize: 'vertical' }} placeholder="미팅 내용, 상담 결과, 주요 논의 사항 등을 기록하세요" /></label>
              <label style={lbl}>담당자<input type="text" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} style={inp} placeholder="담당자명" /></label>
              <label style={lbl}>결과<input type="text" value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))} style={inp} placeholder="계약/검토중/보류 등" /></label>
              <label style={{ ...lbl, gridColumn: '1/-1' }}>비고 / 다음 액션 플랜<input type="text" value={form.next_action} onChange={e => setForm(p => ({ ...p, next_action: e.target.value }))} style={inp} placeholder="다음 방문 일정, 후속 조치, 준비 사항 등" /></label>
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 20px', color: '#475569', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ background: '#4f46e5', border: 'none', borderRadius: 8, padding: '10px 28px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>저장하기</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
function statBox(bg: string, accent: string, dark: string): React.CSSProperties { return { background: bg, padding: 12, borderRadius: 10, border: `1px solid ${bg === '#f8fafc' ? '#e2e8f0' : bg}` } }
function headerBtn(bg: string): React.CSSProperties { return { background: bg, border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' } }
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#475569' }
const inp: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', color: '#1e293b', fontSize: 14, outline: 'none', marginTop: 2 }
