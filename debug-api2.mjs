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

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })

console.log('=== FC variante A: tiempos en Z (UTC) sin encodear ===')
const startZ = new Date(`${today}T00:00:00+02:00`).toISOString()
const endZ = new Date(`${today}T23:59:59+02:00`).toISOString()
const a = await get(`/dataTypes/heart-rate/dataPoints?filter=heart_rate.time.physical_time >= "${startZ}" AND heart_rate.time.physical_time <= "${endZ}"`)
console.log('status:', a.status, '| puntos:', a.json?.dataPoints?.length, '| nextPageToken:', a.json?.nextPageToken ? 'SÍ' : 'no')
if (a.status !== 200) console.log('error:', JSON.stringify(a.json || a.text).slice(0, 300))
if (a.json?.dataPoints?.[0]) console.log('sample:', JSON.stringify(a.json.dataPoints[0]).slice(0, 300))

console.log('\n=== FC variante B: offset +02:00 con filtro URL-encodeado ===')
const filterB = `heart_rate.time.physical_time >= "${today}T00:00:00+02:00" AND heart_rate.time.physical_time <= "${today}T23:59:59+02:00"`
const b = await get(`/dataTypes/heart-rate/dataPoints?filter=${encodeURIComponent(filterB)}`)
console.log('status:', b.status, '| puntos:', b.json?.dataPoints?.length, '| nextPageToken:', b.json?.nextPageToken ? 'SÍ' : 'no')
if (b.status !== 200) console.log('error:', JSON.stringify(b.json || b.text).slice(0, 300))

console.log('\n=== SLEEP con pageSize=50 ===')
const start = new Date()
start.setDate(start.getDate() - 6)
const startStr = start.toISOString().split('T')[0]
const s = await get(`/dataTypes/sleep/dataPoints:reconcile?dataSourceFamily=users/me/dataSourceFamilies/google-wearables&pageSize=50&filter=sleep.interval.civil_end_time >= "${startStr}"`)
console.log('status:', s.status, '| puntos:', s.json?.dataPoints?.length, '| nextPageToken:', s.json?.nextPageToken ? 'SÍ' : 'no')
for (const p of s.json?.dataPoints || []) {
  console.log(' - end:', p.sleep?.interval?.endTime, '| asleep:', p.sleep?.summary?.minutesAsleep)
}
