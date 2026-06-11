import { readFileSync } from 'fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }),
})
const { access_token } = await tokenRes.json()
const BASE = 'https://health.googleapis.com/v4/users/me'

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${access_token}` } })
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text) } } catch { return { status: res.status, text } }
}

console.log('=== FC sin filtro (estructura de un punto) ===')
const a = await get(`/dataTypes/heart-rate/dataPoints?pageSize=3`)
console.log('status:', a.status, '| puntos:', a.json?.dataPoints?.length, '| nextPageToken:', a.json?.nextPageToken ? 'SÍ' : 'no')
if (a.status !== 200) console.log('error:', JSON.stringify(a.json || a.text).slice(0, 400))
for (const p of (a.json?.dataPoints || []).slice(0, 2)) {
  console.log('PUNTO COMPLETO:', JSON.stringify(p, null, 1))
}

console.log('\n=== SLEEP sin :reconcile ===')
const start = new Date()
start.setDate(start.getDate() - 6)
const startStr = start.toISOString().split('T')[0]
const s = await get(`/dataTypes/sleep/dataPoints?filter=sleep.interval.civil_end_time >= "${startStr}"`)
console.log('status:', s.status, '| puntos:', s.json?.dataPoints?.length, '| nextPageToken:', s.json?.nextPageToken ? 'SÍ' : 'no')
if (s.status !== 200) console.log('error:', JSON.stringify(s.json || s.text).slice(0, 400))
for (const p of s.json?.dataPoints || []) {
  console.log(' - platform:', p.dataSource?.platform, '| end:', p.sleep?.interval?.endTime, '| asleep:', p.sleep?.summary?.minutesAsleep)
}

console.log('\n=== SLEEP reconcile SIN dataSourceFamily ===')
const s2 = await get(`/dataTypes/sleep/dataPoints:reconcile?filter=sleep.interval.civil_end_time >= "${startStr}"`)
console.log('status:', s2.status, '| puntos:', s2.json?.dataPoints?.length)
if (s2.status !== 200) console.log('error:', JSON.stringify(s2.json || s2.text).slice(0, 300))
for (const p of s2.json?.dataPoints || []) {
  console.log(' - end:', p.sleep?.interval?.endTime, '| asleep:', p.sleep?.summary?.minutesAsleep)
}
