import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: { user } } = await getAdmin().auth.getUser(token)
  if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const claimId = formData.get('claimId') as string

  if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: '파일 크기 10MB 초과' }, { status: 400 })

  const admin = getAdmin()

  // 버킷 없으면 자동 생성
  await admin.storage.createBucket('claim-photos', { public: true }).catch(() => {})

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${claimId}/${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error } = await admin.storage
    .from('claim-photos')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('claim-photos').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
