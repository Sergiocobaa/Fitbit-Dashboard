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
const endZ = new Date(`${today}T23:59:59+02:00`).toISOString().replace('.000', '')

console.log('=== FC con filtro sample_time, paginado ===')
let pageToken = null
let total = 0
let pages = 0
let first = null
let last = null
do {
  const tk = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
  const r = await get(`/dataTypes/heart-rate/dataPoints?pageSize=1000&filter=heart_rate.sample_time.physical_time >= "${startZ}" AND heart_rate.sample_time.physical_time <= "${endZ}"${tk}`)
  if (r.status !== 200) { console.log('status:', r.status, 'error:', JSON.stringify(r.json || r.text).slice(0, 300)); break }
  const pts = r.json.dataPoints || []
  total += pts.length
  pages++
  if (!first && pts.length) first = pts[0].heartRate?.sampleTime?.physicalTime
  if (pts.length) last = pts[pts.length - 1].heartRate?.sampleTime?.physicalTime
  pageToken = r.json.nextPageToken || null
} while (pageToken && pages < 40)
console.log('páginas:', pages, '| total puntos:', total)
console.log('primero:', first, '| último:', last)
