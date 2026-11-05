import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/claims/share  — 공유 토큰 생성 (인증 필요)
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: { user } } = await getAdmin().auth.getUser(token)
  if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const { claimId } = await req.json()
  if (!claimId) return NextResponse.json({ error: 'claimId 필요' }, { status: 400 })

  // 본인 클레임 또는 관리자만 공유 가능
  const { data: claim } = await getAdmin().from('claims').select('user_id, share_token').eq('id', claimId).single()
  if (!claim) return NextResponse.json({ error: '클레임 없음' }, { status: 404 })

  const { data: profile } = await getAdmin().from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  if (claim.user_id !== user.id && !isAdmin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  // 이미 토큰이 있으면 재사용
  const shareToken = claim.share_token || randomUUID()
  if (!claim.share_token) {
    await getAdmin().from('claims').update({ share_token: shareToken }).eq('id', claimId)
  }

  return NextResponse.json({ token: shareToken })
}
