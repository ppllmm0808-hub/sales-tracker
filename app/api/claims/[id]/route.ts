import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUser(token: string) {
  const { data: { user } } = await getAdmin().auth.getUser(token)
  return user
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = await getUser(token)
  if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const { data, error } = await getAdmin()
    .from('claims')
    .select('*, profiles(name, email)')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: '클레임을 찾을 수 없습니다' }, { status: 404 })

  const { data: profile } = await getAdmin()
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  if (data.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = await getUser(token)
  if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const { data: existing } = await getAdmin()
    .from('claims').select('user_id, status').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: '클레임 없음' }, { status: 404 })

  const { data: profile } = await getAdmin()
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  if (existing.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (body.company !== undefined) updates.company = body.company
  if (body.contact !== undefined) updates.contact = body.contact
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.category !== undefined) updates.category = body.category
  if (body.content !== undefined) updates.content = body.content
  if (body.claim_date !== undefined) updates.claim_date = body.claim_date
  if (body.action_taken !== undefined) updates.action_taken = body.action_taken
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === '완료') updates.resolved_at = new Date().toISOString()
    else updates.resolved_at = null
  }
  if (body.photos !== undefined) updates.photos = body.photos

  const { data, error } = await getAdmin()
    .from('claims').update(updates).eq('id', params.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = await getUser(token)
  if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const { data: existing } = await getAdmin()
    .from('claims').select('user_id').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: '클레임 없음' }, { status: 404 })

  const { data: profile } = await getAdmin()
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  if (!isAdmin) {
    return NextResponse.json({ error: '관리자만 삭제할 수 있습니다' }, { status: 403 })
  }

  await getAdmin().from('claims').delete().eq('id', params.id)
  return NextResponse.json({ success: true })
}
