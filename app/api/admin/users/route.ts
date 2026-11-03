import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabaseAdmin.from('profiles').select('role, email').eq('id', user.id).single()
  return (profile?.role === 'admin' || profile?.role === 'owner') ? { ...user, role: profile.role, profileEmail: profile.email } : null
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  let query = supabaseAdmin.from('profiles').select('*').order('created_at')
  // owner가 아니면 owner 계정은 목록에서 숨김
  if ((admin as any).role !== 'owner') {
    query = query.neq('role', 'owner')
  }
  const { data: profiles } = await query
  return NextResponse.json(profiles ?? [])
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { email, name, role, linkOnly } = await req.json()
  if (!email) return NextResponse.json({ error: '이메일을 입력하세요' }, { status: 400 })

  // 이미 등록된 이메일 확인
  const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single()
  if (existing) return NextResponse.json({ error: '이미 등록된 이메일입니다' }, { status: 400 })

  if (linkOnly) {
    // 이메일 발송 없이 초대 링크만 생성
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { data: { name, role: role || 'member' } },
    })
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 })

    await supabaseAdmin.from('profiles').upsert({
      id: linkData.user.id, email, name: name || null, role: role || 'member',
    })
    return NextResponse.json({ success: true, inviteLink: linkData.properties.action_link })
  }

  // 초대 이메일 발송 (본인이 비밀번호 직접 설정)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name, role: role || 'member' },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // 프로필 미리 생성
  await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id, email, name: name || null, role: role || 'member',
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { id, name, role } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  // admin/owner 승격은 owner만 가능
  if (role === 'admin' || role === 'owner') {
    if ((admin as any).role !== 'owner') {
      return NextResponse.json({ error: '관리자 지정은 프로그램 관리자만 가능합니다.' }, { status: 403 })
    }
  }

  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (role !== undefined) updates.role = role
  if (Object.keys(updates).length > 0)
    await supabaseAdmin.from('profiles').update(updates).eq('id', id)

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  await supabaseAdmin.from('profiles').delete().eq('id', id)
  await supabaseAdmin.auth.admin.deleteUser(id)

  return NextResponse.json({ success: true })
}
