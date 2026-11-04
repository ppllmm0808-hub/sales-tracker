import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await getSupabaseAdmin().auth.getUser(token)
  if (!user) return null
  const { data: profile } = await getSupabaseAdmin().from('profiles').select('role, email').eq('id', user.id).single()
  return (profile?.role === 'admin' || profile?.role === 'owner') ? { ...user, role: profile.role, profileEmail: profile.email } : null
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  // owner는 항상 숨김. admin-role 호출자는 admin도 숨김 (member만 조회)
  let query = getSupabaseAdmin().from('profiles').select('*').neq('role', 'owner').order('created_at')
  if ((admin as any).role === 'admin') {
    query = query.neq('role', 'admin')
  }
  const { data: profiles } = await query
  return NextResponse.json(profiles ?? [])
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { email, name, role } = await req.json()
  if (!email) return NextResponse.json({ error: '이메일을 입력하세요' }, { status: 400 })

  // 이미 등록된 이메일 확인
  const { data: existing } = await getSupabaseAdmin().from('profiles').select('id').eq('email', email).single()
  if (existing) return NextResponse.json({ error: '이미 등록된 이메일입니다' }, { status: 400 })

  // 계정 생성 (이메일 발송 없음, 임시 비밀번호 설정)
  const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password: '00000000',
    email_confirm: true,
    user_metadata: { name, role: role || 'member' },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  await getSupabaseAdmin().from('profiles').upsert({
    id: authData.user.id, email, name: name || null, role: role || 'member',
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { id, name, role, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  // admin/owner 승격은 owner만 가능
  if (role === 'admin' || role === 'owner') {
    if ((admin as any).role !== 'owner') {
      return NextResponse.json({ error: '관리자 지정은 프로그램 관리자만 가능합니다.' }, { status: 403 })
    }
  }

  // 비밀번호 변경 (관리자가 초기화)
  if (password) {
    const { error: pwError } = await getSupabaseAdmin().auth.admin.updateUserById(id, { password })
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 400 })
  }

  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (role !== undefined) updates.role = role
  if (Object.keys(updates).length > 0)
    await getSupabaseAdmin().from('profiles').update(updates).eq('id', id)

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  await getSupabaseAdmin().from('profiles').delete().eq('id', id)
  await getSupabaseAdmin().auth.admin.deleteUser(id)

  return NextResponse.json({ success: true })
}
