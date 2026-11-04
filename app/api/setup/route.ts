import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const OWNER_EMAIL = 'ppllmm0808@gmail.com'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: { user } } = await getSupabaseAdmin().auth.getUser(token)
  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: '권한 없음 — 프로그램 관리자 계정으로만 실행 가능합니다' }, { status: 403 })
  }

  // 이미 owner인지 확인
  const { data: existing } = await getSupabaseAdmin()
    .from('profiles').select('role').eq('email', OWNER_EMAIL).single()
  if (existing?.role === 'owner') {
    return NextResponse.json({ success: true, message: '이미 프로그램 관리자로 설정되어 있습니다' })
  }

  // role = owner 업데이트 시도
  const { error } = await getSupabaseAdmin()
    .from('profiles').update({ role: 'owner' }).eq('email', OWNER_EMAIL)

  if (error) {
    // CHECK 제약 조건 위반 → Supabase 대시보드 Table Editor에서 수동 변경 필요
    return NextResponse.json({
      error: 'CHECK 제약 조건 오류',
      detail: error.message,
      action: 'Supabase 대시보드 → Table Editor → profiles → role 값을 owner로 직접 변경',
    }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: '프로그램 관리자로 설정 완료!' })
}
