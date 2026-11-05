'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

const ACTION_TYPES = ['교환', '반품', '협의완료', '수리', '환불', 'AS처리', '기타']

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

function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('압축 실패')), 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function ClaimDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myId, setMyId] = useState('')
  const [token, setToken] = useState('')

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ company: '', contact: '', phone: '', category: '', content: '', action_type: '', action_taken: '', claim_date: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharingLoading, setSharingLoading] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return }
      const tok = data.session.access_token
      setToken(tok)
      setMyId(data.session.user.id)

      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).single()
      if (p?.role === 'admin' || p?.role === 'owner') setIsAdmin(true)

      const res = await fetch(`/api/claims/${id}`, { headers: { Authorization: `Bearer ${tok}` } })
      if (!res.ok) { router.push('/claims'); return }
      const c = await res.json()
      setClaim(c)
      setEditForm({
        company: c.company, contact: c.contact || '', phone: c.phone || '',
        category: c.category, content: c.content, action_type: c.action_type || '',
        action_taken: c.action_taken || '', claim_date: c.claim_date,
      })
      setLoading(false)
    })
  }, [id, router])

  async function updateStatus(status: string) {
    if (!claim) return
    setSaving(true)
    const res = await fetch(`/api/claims/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setClaim(await res.json())
    setSaving(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg('')
    const hasAction = editForm.action_taken?.trim()

    // 조치내용 있으면 완료, 없으면 처리중(완료였을 때만 되돌림)
    const autoStatus = hasAction
      ? '완료'
      : (claim?.status === '완료' ? '처리중' : claim?.status)

    const res = await fetch(`/api/claims/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, status: autoStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setClaim(updated)
      setEditing(false)
      setMsg(hasAction ? '✅ 저장됐습니다 — 완료 처리됐습니다' : '✅ 저장됐습니다')
    } else {
      const d = await res.json()
      setMsg(`❌ ${d.error}`)
    }
    setSaving(false)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !claim) return
    setUploading(true)
    const urls: string[] = [...(claim.photos || [])]

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file)
        const compFile = new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
        const fd = new FormData()
        fd.append('file', compFile)
        fd.append('claimId', id)
        const res = await fetch('/api/claims/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        if (res.ok) {
          const { url } = await res.json()
          urls.push(url)
        }
      } catch {}
    }

    // photos 배열 업데이트
    const patchRes = await fetch(`/api/claims/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: urls }),
    })
    if (patchRes.ok) setClaim(await patchRes.json())
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDeletePhoto(url: string) {
    if (!claim || !confirm('이 사진을 삭제할까요?')) return
    const photos = claim.photos.filter(p => p !== url)
    const res = await fetch(`/api/claims/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos }),
    })
    if (res.ok) setClaim(await res.json())
  }

  async function handleShare() {
    setSharingLoading(true)
    const res = await fetch('/api/claims/share', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId: id }),
    })
    if (res.ok) {
      const { token: shareToken } = await res.json()
      const url = `${location.origin}/claims/share/${shareToken}`
      setShareUrl(url)
      // 공유 링크 생성 시 즉시 처리중으로 변경
      if (claim?.status === '접수') {
        const patchRes = await fetch(`/api/claims/${id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: '처리중' }),
        })
        if (patchRes.ok) setClaim(await patchRes.json())
      }
      setShowShareModal(true)
    }
    setSharingLoading(false)
  }

  async function handleDelete() {
    if (!confirm('이 클레임을 삭제할까요? 사진도 모두 삭제됩니다.')) return
    setDeleting(true)
    await fetch(`/api/claims/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    router.push('/claims')
  }

  const canEdit = claim && (claim.user_id === myId || isAdmin)
  const ss = claim ? (STATUS_STYLE[claim.status] || STATUS_STYLE['접수']) : null
  const cs = claim ? (CAT_STYLE[claim.category] || CAT_STYLE['기타']) : null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#64748b' }}>불러오는 중...</p>
    </div>
  )
  if (!claim || !ss || !cs) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#dc2626', color: '#fff', padding: isMobile ? '10px 14px' : '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/claims')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>‹</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16 }}>{claim.company}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{claim.claim_date}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ background: ss.bg, color: ss.text, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{ss.icon} {claim.status}</span>
          <button onClick={handleShare} disabled={sharingLoading} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: isMobile ? '5px 10px' : '6px 14px', color: '#fff', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
            {sharingLoading ? '...' : '📤 공유'}
          </button>
          {canEdit && !editing && (
            <button onClick={() => { setEditing(true); setMsg('') }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: isMobile ? '5px 10px' : '6px 14px', color: '#fff', cursor: 'pointer', fontSize: 12 }}>수정</button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {msg && (
          <div style={{ background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.startsWith('✅') ? '#86efac' : '#fca5a5'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: msg.startsWith('✅') ? '#15803d' : '#dc2626' }}>{msg}</div>
        )}

        {/* 상태 변경 버튼 */}
        {canEdit && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>처리 상태 변경</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['접수', '처리중', '완료'].map(s => {
                const st = STATUS_STYLE[s]
                const active = claim.status === s
                // 처리중: 버튼 클릭 불가 (공유 시 자동)
                // 완료: 조치내용 없으면 불가
                // 접수 복원: 관리자만
                const blocked =
                  s === '처리중' ||
                  (s === '완료' && !claim.action_taken) ||
                  (s === '접수' && !isAdmin)
                const disabledBtn = saving || active || blocked
                return (
                  <button key={s} onClick={() => !disabledBtn && updateStatus(s)}
                    disabled={disabledBtn}
                    title={
                      s === '처리중' ? '공유 버튼으로 자동 변경됩니다' :
                      s === '완료' && !claim.action_taken ? '조치 내용을 먼저 입력하세요' :
                      s === '접수' && !isAdmin ? '관리자만 가능합니다' : ''
                    }
                    style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${active ? st.text : '#e2e8f0'}`, background: active ? st.bg : blocked && !active ? '#f8fafc' : '#f8fafc', color: active ? st.text : blocked ? '#cbd5e1' : '#94a3b8', fontWeight: 700, fontSize: 13, cursor: disabledBtn ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: blocked && !active ? 0.5 : 1 }}>
                    {st.icon} {s}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              💡 조치 내용 저장 시 자동으로 완료 처리됩니다
            </div>
          </div>
        )}

        {/* 클레임 정보 */}
        {editing ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 16 }}>클레임 정보 수정</div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={lbl}>날짜<input type="date" value={editForm.claim_date} onChange={e => setEditForm(p => ({ ...p, claim_date: e.target.value }))} style={inp} /></label>
                <label style={lbl}>유형
                  <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                    {['불량','배송','AS','계약','기타'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={lbl}>거래처명 *<input required value={editForm.company} onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))} style={inp} /></label>
                <label style={lbl}>담당자<input value={editForm.contact} onChange={e => setEditForm(p => ({ ...p, contact: e.target.value }))} style={inp} /></label>
              </div>
              <label style={lbl}>연락처<input type="tel" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} style={inp} /></label>
              <label style={lbl}>클레임 내용 *<textarea required value={editForm.content} onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))} style={{ ...inp, height: 80, resize: 'vertical' }} /></label>
              <label style={lbl}>처리 유형
                <select value={editForm.action_type} onChange={e => setEditForm(p => ({ ...p, action_type: e.target.value }))} style={inp}>
                  <option value="">선택 안 함</option>
                  {ACTION_TYPES.map(a => <option key={a}>{a}</option>)}
                </select>
              </label>
              <label style={lbl}>
                조치 내용
                <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 400, marginLeft: 6 }}>✓ 입력 후 저장하면 자동으로 완료 처리</span>
                <textarea value={editForm.action_taken} onChange={e => setEditForm(p => ({ ...p, action_taken: e.target.value }))} style={{ ...inp, height: 70, resize: 'vertical' }} placeholder="교환/반품/수리 등 처리 상세 내용을 입력하면 완료로 변경됩니다" />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setEditing(false)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 11, color: '#475569', cursor: 'pointer', fontSize: 14 }}>취소</button>
                <button type="submit" disabled={saving} style={{ flex: 2, background: '#dc2626', border: 'none', borderRadius: 8, padding: 11, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{saving ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ background: cs.bg, color: cs.text, borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{claim.category}</span>
              {claim.action_type && <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>🔧 {claim.action_type}</span>}
              {claim.resolved_at && <span style={{ fontSize: 12, color: '#94a3b8' }}>완료: {new Date(claim.resolved_at).toLocaleDateString('ko-KR')}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>거래처</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{claim.company}</div>
              </div>
              {claim.contact && (
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>담당자</div>
                  <div style={{ fontSize: 14, color: '#1e293b' }}>{claim.contact}</div>
                </div>
              )}
              {claim.phone && (
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>연락처</div>
                  <a href={`tel:${claim.phone}`} style={{ fontSize: 14, color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>{claim.phone}</a>
                </div>
              )}
              {isAdmin && claim.profiles && (
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>등록자</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>{claim.profiles.name || claim.profiles.email}</div>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>클레임 내용</div>
              <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.7, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', whiteSpace: 'pre-wrap' }}>{claim.content}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>조치 내용</div>
              {claim.action_taken ? (
                <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.7, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', whiteSpace: 'pre-wrap' }}>{claim.action_taken}</div>
              ) : canEdit ? (
                <button onClick={() => setEditing(true)} style={{ width: '100%', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 10, padding: '12px', color: '#16a34a', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  + 조치 내용 입력
                </button>
              ) : (
                <div style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>(미입력)</div>
              )}
            </div>
          </div>
        )}

        {/* 사진 */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>
            📷 현장 사진
            {claim.photos?.length > 0 && <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 400 }}> ({claim.photos.length}장)</span>}
          </div>

          {/* 사진 그리드 */}
          {claim.photos?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {claim.photos.map((url, i) => (
                <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#f1f5f9' }}>
                  <img src={url} alt={`사진 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setLightbox(url)} />
                  {canEdit && (
                    <button onClick={() => handleDeletePhoto(url)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 업로드 영역 */}
          {canEdit && (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  width: '100%', border: '2px dashed #bfdbfe', borderRadius: 12,
                  padding: '24px 16px', background: uploading ? '#f8fafc' : '#eff6ff',
                  cursor: uploading ? 'default' : 'pointer', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}>
                <span style={{ fontSize: 36 }}>{uploading ? '⏳' : '📷'}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: uploading ? '#94a3b8' : '#1d4ed8' }}>
                  {uploading ? '사진 업로드 중...' : '사진 추가하기'}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {uploading ? '잠시 기다려 주세요' : '갤러리에서 선택 또는 카메라 촬영 · 여러 장 동시 선택 가능'}
                </span>
              </button>
            </>
          )}

          {!canEdit && claim.photos?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>등록된 사진이 없습니다</div>
          )}
        </div>

        {/* 삭제 버튼 — 관리자/시스템관리자만 표시 */}
        {isAdmin && (
          <button onClick={handleDelete} disabled={deleting}
            style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 10, padding: 12, color: '#dc2626', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            {deleting ? '삭제 중...' : '🗑️ 이 클레임 삭제'}
          </button>
        )}
      </main>

      {/* 공유 모달 */}
      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, padding: 24, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a', marginBottom: 4 }}>📤 PDF 공유 링크</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              링크를 단톡방이나 카톡에 붙여넣기 하세요.<br />
              {claim?.status === '처리중' && <span style={{ color: '#ca8a04', fontWeight: 600 }}>🟡 상태가 처리중으로 변경됐습니다</span>}
            </div>
            {/* 링크 표시 */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#475569', wordBreak: 'break-all', marginBottom: 14 }}>
              {shareUrl}
            </div>
            {/* 버튼들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    alert('링크가 복사됐습니다! 카톡 단톡방에 붙여넣기 하세요 📋')
                  })
                }}
                style={{ background: '#0f172a', border: 'none', borderRadius: 10, padding: 13, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                📋 링크 복사
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={() => {
                    navigator.share({
                      title: `클레임 접수서 — ${claim?.company}`,
                      text: `[클레임 접수] ${claim?.company} / ${claim?.claim_date}\n내용: ${claim?.content?.slice(0, 50)}`,
                      url: shareUrl,
                    }).catch(() => {})
                  }}
                  style={{ background: '#fee500', border: 'none', borderRadius: 10, padding: 13, color: '#3c1e1e', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                >
                  💬 카카오톡으로 공유
                </button>
              )}
              <button
                onClick={() => setShowShareModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, padding: 12, color: '#475569', cursor: 'pointer', fontSize: 14 }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={lightbox} alt="사진 크게 보기" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#475569' }
const inp: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', color: '#1e293b', fontSize: 14, outline: 'none', marginTop: 2 }
