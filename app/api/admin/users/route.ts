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
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data: profiles } = await supabaseAdmin.from('profiles').select('*').order('created_at')
  return NextResponse.json(profiles ?? [])
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { email, password, name, role } = await req.json()
  if (!email || !password) return NextResponse.json({ error: '이메일과 비밀번호를 입력하세요' }, { status: 400 })

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  await supabaseAdmin.from('profiles').insert({
    id: authData.user.id, email, name: name || null, role: role || 'member',
  })

  return NextResponse.json({ success: true, id: authData.user.id })
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { id, name, role, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (role !== undefined) updates.role = role
  if (Object.keys(updates).length > 0)
    await supabaseAdmin.from('profiles').update(updates).eq('id', id)

  if (password) {
    await supabaseAdmin.auth.admin.updateUserById(id, { password })
  }

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
