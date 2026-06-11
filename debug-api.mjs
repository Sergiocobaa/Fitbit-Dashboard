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

const start = new Date()
start.setDate(start.getDate() - 6)
const startStr = start.toISOString().split('T')[0]

console.log('=== SLEEP (>= ' + startStr + ') ===')
const sleep = await get(`/dataTypes/sleep/dataPoints:reconcile?dataSourceFamily=users/me/dataSourceFamilies/google-wearables&filter=sleep.interval.civil_end_time >= "${startStr}"`)
console.log('status:', sleep.status, '| puntos:', sleep.json?.dataPoints?.length)
for (const p of sleep.json?.dataPoints || []) {
  console.log(' - interval:', JSON.stringify(p.sleep?.interval), '| minutesAsleep:', p.sleep?.summary?.minutesAsleep)
}

console.log('\n=== HRV (>= ' + startStr + ') ===')
const hrv = await get(`/dataTypes/daily-heart-rate-variability/dataPoints?filter=daily_heart_rate_variability.date >= "${startStr}"`)
console.log('status:', hrv.status, '| puntos:', hrv.json?.dataPoints?.length)
for (const p of (hrv.json?.dataPoints || []).slice(0, 5)) {
  console.log(' - platform:', p.dataSource?.platform, '| date:', JSON.stringify(p.dailyHeartRateVariability?.date), '| avg:', p.dailyHeartRateVariability?.averageHeartRateVariabilityMilliseconds)
}

console.log('\n=== HEART RATE intradiario hoy ===')
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
const hr = await get(`/dataTypes/heart-rate/dataPoints?filter=heart_rate.time.physical_time >= "${today}T00:00:00+02:00" AND heart_rate.time.physical_time <= "${today}T23:59:59+02:00"`)
console.log('status:', hr.status, '| puntos:', hr.json?.dataPoints?.length)
if (hr.text) console.log('raw:', hr.text.slice(0, 500))
for (const p of (hr.json?.dataPoints || []).slice(0, 3)) {
  console.log(' - sample:', JSON.stringify(p).slice(0, 300))
}
console.log('nextPageToken:', hr.json?.nextPageToken ? 'SÍ' : 'no')
