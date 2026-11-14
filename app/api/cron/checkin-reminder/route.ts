import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: '권한 없음' }, { status: 401 })
  }

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return NextResponse.json({ error: 'VAPID 키 미설정' }, { status: 500 })
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv)

  // 한국시간(KST) 기준 오늘 날짜·요일
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  const today = kst.toISOString().slice(0, 10)
  const dow = kst.getUTCDay()
  if (dow === 0 || dow === 6) return NextResponse.json({ skipped: '주말' })

  const admin = getAdmin()
  const { data: subs } = await admin.from('push_subscriptions').select('*')
  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const userIds = [...new Set(subs.map(s => s.user_id))]
  const { data: logs } = await admin
    .from('sales_logs').select('user_id, check_in_time, is_working')
    .eq('log_date', today).in('user_id', userIds)
  const skipUsers = new Set(
    (logs ?? []).filter(l => l.check_in_time || l.is_working === false).map(l => l.user_id)
  )

  const payload = JSON.stringify({
    title: '🏢 출근 체크인 시간입니다',
    body: '출근 체크인을 누르지 않으면 휴가로 처리됩니다.',
    url: '/dashboard',
  })

  let sent = 0
  for (const s of subs) {
    if (skipUsers.has(s.user_id)) continue
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      sent++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
  }
  return NextResponse.json({ sent, date: today })
}
