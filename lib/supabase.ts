import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Profile {
  id: string
  email: string
  name: string | null
  role: 'member' | 'admin'
  created_at: string
}

export interface SalesLog {
  id: string
  user_id: string
  log_date: string
  summary: string | null
  weather: string | null
  is_working: boolean
  check_in_time: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_in_address: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Activity {
  id: string
  log_id: string
  user_id: string
  activity_time: string
  end_time: string | null
  activity_type: string
  company: string | null
  contact: string | null
  address: string | null
  content: string | null
  result: string | null
  next_action: string | null
  lat: number | null
  lng: number | null
  created_at: string
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function getOrCreateLog(userId: string, date: string): Promise<SalesLog | null> {
  const { data: existing } = await supabase
    .from('sales_logs').select('*').eq('user_id', userId).eq('log_date', date).single()
  if (existing) return existing
  const { data } = await supabase
    .from('sales_logs').insert({ user_id: userId, log_date: date }).select().single()
  return data
}

export async function getActivities(logId: string): Promise<Activity[]> {
  const { data } = await supabase
    .from('activities').select('*').eq('log_id', logId).order('activity_time')
  return data ?? []
}

export async function saveActivity(activity: Omit<Activity, 'id' | 'created_at'>): Promise<Activity | null> {
  const { data } = await supabase.from('activities').insert(activity).select().single()
  return data
}

export async function updateActivity(id: string, updates: Partial<Activity>): Promise<void> {
  await supabase.from('activities').update(updates).eq('id', id)
}

export async function deleteActivity(id: string): Promise<void> {
  await supabase.from('activities').delete().eq('id', id)
}

export async function updateLogSummary(logId: string, summary: string): Promise<void> {
  await supabase.from('sales_logs')
    .update({ summary, updated_at: new Date().toISOString() }).eq('id', logId)
}

export async function updateLogWorking(logId: string, is_working: boolean): Promise<void> {
  await supabase.from('sales_logs')
    .update({ is_working, updated_at: new Date().toISOString() }).eq('id', logId)
}

export async function checkInLog(logId: string, time: string, lat: number, lng: number, address: string): Promise<void> {
  await supabase.from('sales_logs')
    .update({ check_in_time: time, check_in_lat: lat, check_in_lng: lng, check_in_address: address, updated_at: new Date().toISOString() }).eq('id', logId)
}

export async function getAllLogsForDate(date: string): Promise<SalesLog[]> {
  const { data } = await supabase
    .from('sales_logs').select('*, profiles(name, email, role)').eq('log_date', date)
  return data ?? []
}

export async function getActivitiesByLogIds(logIds: string[]): Promise<Activity[]> {
  if (!logIds.length) return []
  const { data } = await supabase
    .from('activities').select('*').in('log_id', logIds).order('activity_time')
  return data ?? []
}
