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
  const [editForm, setEditForm] = useState({ company: '', contact: '', phone: '', category: '', content: '', action_taken: '', claim_date: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
        category: c.category, content: c.content, action_taken: c.action_taken || '',
        claim_date: c.claim_date,
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
    const res = await fetch(`/api/claims/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      const updated = await res.json()
      setClaim(updated)
      setEditing(false)
      setMsg('✅ 저장됐습니다')
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
                return (
                  <button key={s} onClick={() => updateStatus(s)} disabled={saving || active}
                    style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${active ? st.text : '#e2e8f0'}`, background: active ? st.bg : '#f8fafc', color: active ? st.text : '#94a3b8', fontWeight: 700, fontSize: 13, cursor: active ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                    {st.icon} {s}
                  </button>
                )
              })}
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
              <label style={lbl}>조치 내용<textarea value={editForm.action_taken} onChange={e => setEditForm(p => ({ ...p, action_taken: e.target.value }))} style={{ ...inp, height: 70, resize: 'vertical' }} placeholder="처리 내용, 조치 결과 등" /></label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setEditing(false)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 11, color: '#475569', cursor: 'pointer', fontSize: 14 }}>취소</button>
                <button type="submit" disabled={saving} style={{ flex: 2, background: '#dc2626', border: 'none', borderRadius: 8, padding: 11, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{saving ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: cs.bg, color: cs.text, borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{claim.category}</span>
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

            {claim.action_taken ? (
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>조치 내용</div>
                <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.7, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', whiteSpace: 'pre-wrap' }}>{claim.action_taken}</div>
              </div>
            ) : canEdit && (
              <button onClick={() => setEditing(true)} style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 10, padding: '12px', color: '#16a34a', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                + 조치 내용 입력
              </button>
            )}
          </div>
        )}

        {/* 사진 */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>📷 현장 사진 {claim.photos?.length > 0 && <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 400 }}>({claim.photos.length}장)</span>}</div>
            {canEdit && (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ background: uploading ? '#f1f5f9' : '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 14px', color: uploading ? '#94a3b8' : '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: uploading ? 'default' : 'pointer' }}>
                {uploading ? '업로드 중...' : '📷 사진 추가'}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </div>

          {claim.photos?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {claim.photos.map((url, i) => (
                <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#f1f5f9' }}>
                  <img src={url} alt={`사진 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setLightbox(url)} />
                  {canEdit && (
                    <button onClick={() => handleDeletePhoto(url)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
              {canEdit ? '위 버튼으로 현장 사진을 추가하세요' : '등록된 사진이 없습니다'}
            </div>
          )}
        </div>

        {/* 삭제 버튼 */}
        {canEdit && (
          <button onClick={handleDelete} disabled={deleting}
            style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 10, padding: 12, color: '#dc2626', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            {deleting ? '삭제 중...' : '🗑️ 이 클레임 삭제'}
          </button>
        )}
      </main>

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
