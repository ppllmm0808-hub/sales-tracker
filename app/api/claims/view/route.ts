import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/claims/view?token=xxx  — 공개 조회 + 접수→처리중 자동 전환
export async function GET(req: NextRequest) {
  const shareToken = req.nextUrl.searchParams.get('token')
  if (!shareToken) return NextResponse.json({ error: '토큰 없음' }, { status: 400 })

  const admin = getAdmin()
  const { data: claim } = await admin
    .from('claims')
    .select('*, profiles(name, email)')
    .eq('share_token', shareToken)
    .single()

  if (!claim) return NextResponse.json({ error: '유효하지 않은 링크' }, { status: 404 })

  // 접수 상태이면 처리중으로 자동 전환
  if (claim.status === '접수') {
    await admin.from('claims').update({
      status: '처리중',
      updated_at: new Date().toISOString(),
    }).eq('id', claim.id)
    claim.status = '처리중'
  }

  return NextResponse.json(claim)
}
