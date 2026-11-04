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
  const { data: profile } = await getSupabaseAdmin().from('profiles').select('role').eq('id', user.id).single()
  return (profile?.role === 'admin' || profile?.role === 'owner') ? { ...user, role: profile.role } : null
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ error: '기간을 입력하세요' }, { status: 400 })

  const { data: rawLogs } = await supabaseAdmin
    .from('sales_logs')
    .select('*, profiles(name, email, role)')
    .gte('log_date', start)
    .lte('log_date', end)
    .order('log_date')
    .order('user_id')

  // 요청한 관리자 본인 데이터만 제외 (다른 관리자는 포함)
  const logs = (rawLogs || []).filter(l => l.user_id !== admin.id)

  if (!logs || logs.length === 0) return NextResponse.json([])

  const logIds = logs.map(l => l.id)
  const { data: activities } = await supabaseAdmin
    .from('activities')
    .select('*')
    .in('log_id', logIds)
    .order('activity_time')

  const result = logs.map(log => ({
    ...log,
    activities: (activities || []).filter(a => a.log_id === log.id),
  }))

  return NextResponse.json(result)
}
