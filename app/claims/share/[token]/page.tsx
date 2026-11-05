'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Claim = {
  id: string
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
  profiles?: { name: string | null; email: string } | null
}

export default function ClaimSharePage() {
  const params = useParams()
  const token = params.token as string
  const [claim, setClaim] = useState<Claim | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [autoChanged, setAutoChanged] = useState(false)

  useEffect(() => {
    fetch(`/api/claims/view?token=${token}`)
      .then(async res => {
        if (!res.ok) { setError((await res.json()).error || '오류'); return }
        const data = await res.json()
        if (data.status === '처리중') setAutoChanged(true)
        setClaim(data)
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ color: '#64748b' }}>불러오는 중...</p>
    </div>
  )

  if (error || !claim) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ color: '#dc2626', fontWeight: 700, marginTop: 12 }}>{error || '클레임을 찾을 수 없습니다'}</p>
        <p style={{ color: '#64748b', fontSize: 14 }}>링크가 만료됐거나 잘못된 링크입니다</p>
      </div>
    </div>
  )

  return (
    <>
      {/* 화면 전용 상단 바 */}
      <div className="no-print" style={{ background: '#dc2626', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>📋 고객 클레임 접수서</span>
          {autoChanged && (
            <span style={{ marginLeft: 12, background: '#fef9c3', color: '#92400e', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
              🟡 처리중으로 자동 변경됨
            </span>
          )}
        </div>
        <button
          onClick={() => window.print()}
          style={{ background: '#fff', border: 'none', borderRadius: 8, padding: '6px 16px', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          🖨️ PDF 저장
        </button>
      </div>

      {/* 인쇄 대상 본문 */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px', fontFamily: '맑은 고딕, Apple SD Gothic Neo, system-ui, sans-serif', fontSize: 13, color: '#1e293b' }}>

        {/* 제목 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', letterSpacing: '-0.5px' }}>고객 클레임 접수서</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Customer Claim Report</div>
        </div>

        {/* 기본 정보 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <tbody>
            <tr>
              <Td label>접수 일자</Td>
              <Td>{claim.claim_date}</Td>
              <Td label>클레임 유형</Td>
              <Td>{claim.category}</Td>
            </tr>
            <tr>
              <Td label>거래처명</Td>
              <Td>{claim.company}</Td>
              <Td label>담당자</Td>
              <Td>{claim.contact || '-'}</Td>
            </tr>
            <tr>
              <Td label>연락처</Td>
              <Td>{claim.phone || '-'}</Td>
              <Td label>처리 유형</Td>
              <Td>{claim.action_type || '-'}</Td>
            </tr>
            <tr>
              <Td label>처리 상태</Td>
              <Td>{claim.status}</Td>
              <Td label>등록자</Td>
              <Td>{claim.profiles?.name || claim.profiles?.email || '-'}</Td>
            </tr>
          </tbody>
        </table>

        {/* 클레임 내용 */}
        <SectionTitle>클레임 내용</SectionTitle>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 14px', background: '#fef2f2', minHeight: 60, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
          {claim.content}
        </div>

        {/* 조치 내용 */}
        <SectionTitle>조치 내용</SectionTitle>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 14px', background: '#f0fdf4', minHeight: 60, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
          {claim.action_taken || '(처리 중)'}
        </div>

        {/* 현장 사진 */}
        {claim.photos?.length > 0 && (
          <>
            <SectionTitle>현장 사진 ({claim.photos.length}장)</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {claim.photos.map((url, i) => (
                <div key={i} style={{ aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <img src={url} alt={`사진 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* 서명란 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 32 }}>
          <tbody>
            <tr>
              {['접수자', '처리 담당자', '확인'].map(label => (
                <td key={label} style={{ border: '1px solid #cbd5e1', padding: '8px 12px', textAlign: 'center', width: '33%' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 32 }}>{label}</div>
                  <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: 4, fontSize: 11, color: '#94a3b8' }}>(서명)</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 20, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
          발행일시: {new Date().toLocaleString('ko-KR')}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
    </>
  )
}

function Td({ children, label }: { children: React.ReactNode; label?: boolean }) {
  return (
    <td style={{
      border: '1px solid #e2e8f0',
      padding: '8px 12px',
      background: label ? '#f8fafc' : '#fff',
      fontWeight: label ? 600 : 400,
      color: label ? '#475569' : '#1e293b',
      width: label ? '18%' : '32%',
      fontSize: 13,
    }}>
      {children}
    </td>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 700, fontSize: 13, color: '#475569', borderLeft: '3px solid #dc2626', paddingLeft: 8, marginBottom: 8 }}>
      {children}
    </div>
  )
}
