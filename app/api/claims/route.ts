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

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = await getUser(token)
  if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const { data: profile } = await getAdmin()
    .from('profiles').select('role').eq('id', user.id).single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  let query = getAdmin()
    .from('claims')
    .select('*, profiles(name, email)')
    .order('claim_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (!isAdmin) query = query.eq('user_id', user.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = await getUser(token)
  if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const body = await req.json()
  const { company, contact, phone, category, content, claim_date } = body

  if (!company || !content) {
    return NextResponse.json({ error: '거래처명과 클레임 내용은 필수입니다' }, { status: 400 })
  }

  const { data, error } = await getAdmin()
    .from('claims')
    .insert({
      user_id: user.id,
      company,
      contact: contact || null,
      phone: phone || null,
      category: category || '기타',
      content,
      claim_date: claim_date || new Date().toISOString().split('T')[0],
      status: '접수',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
