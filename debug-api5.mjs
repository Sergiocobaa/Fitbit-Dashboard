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
const startZ = new Date(`${today}T00:00:00+02:00`).toISOString().replace('.000', '')

async function probe(name, filter) {
  const r = await get(`/dataTypes/heart-rate/dataPoints?pageSize=2&filter=${filter}`)
  const n = r.json?.dataPoints?.length
  const msg = r.status === 200 ? `OK puntos=${n}` : JSON.stringify(r.json?.error?.message || r.text).slice(0, 120)
  console.log(`${name}: ${r.status} ${msg}`)
  if (r.status === 200 && n) {
    console.log('   sample time:', r.json.dataPoints[0].heartRate?.sampleTime?.physicalTime)
  }
}

await probe('A) physical_time > (solo)', `heart_rate.sample_time.physical_time > "${startZ}"`)
await probe('B) physical_time >= (solo)', `heart_rate.sample_time.physical_time >= "${startZ}"`)
await probe('C) civil date =', `heart_rate.sample_time.civil_time.date = "${today}"`)
await probe('D) civil date >=', `heart_rate.sample_time.civil_time.date >= "${today}"`)
await probe('E) sample_time >=', `heart_rate.sample_time >= "${startZ}"`)
