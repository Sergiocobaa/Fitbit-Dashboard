const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const HEALTH_BASE = 'https://health.googleapis.com/v4/users/me'

export async function getAccessToken() {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('No se pudo renovar el access token')
  const data = await res.json()
  return data.access_token
}

async function healthFetch(path, token, fresh = false) {
  const res = await fetch(`${HEALTH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    ...(fresh ? { cache: 'no-store' } : { next: { revalidate: 300 } }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Health API error ${res.status}: ${err}`)
  }
  return res.json()
}

export function todayMadrid() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
}

// offset UTC de Madrid para esa fecha ("+01:00" o "+02:00" según DST)
function madridOffset(dateStr) {
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${dateStr}T12:00:00Z`))
    .find(p => p.type === 'timeZoneName').value
  const m = tzName.match(/([+-]\d{2}:\d{2})/)
  return m ? m[1] : '+00:00'
}

function pointDate(d) {
  if (!d) return null
  if (typeof d === 'string') return d.split('T')[0]
  if (d.year) return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  return null
}

function parseSleepPoint(point) {
  const s = point.summary
  const stages = {}
  for (const st of (point.stages || [])) {
    stages[st.type] = (stages[st.type] || 0) + (new Date(st.endTime) - new Date(st.startTime)) / 60000
  }
  return {
    minutesAsleep: parseInt(s.minutesAsleep),
    minutesAwake: parseInt(s.minutesAwake),
    deep: Math.round(stages.DEEP || 0),
    rem: Math.round(stages.REM || 0),
    light: Math.round(stages.LIGHT || 0),
    startTime: point.interval.startTime,
    endTime: point.interval.endTime,
    segments: (point.stages || []).map(st => ({ type: st.type, start: st.startTime, end: st.endTime })),
  }
}

function sleepEndDate(point) {
  return pointDate(point.interval?.civilEndTime || point.interval?.endTime)
}

// Noche que termina la mañana del día dateStr
export async function getSleepForDate(token, dateStr, fresh = false) {
  const data = await healthFetch(
    `/dataTypes/sleep/dataPoints:reconcile?dataSourceFamily=users/me/dataSourceFamilies/google-wearables&filter=sleep.interval.civil_end_time >= "${dateStr}"`,
    token, fresh
  )
  const points = (data.dataPoints || []).filter(p => p.sleep?.summary)
  const sameDay = points.filter(p => sleepEndDate(p.sleep) === dateStr).map(p => parseSleepPoint(p.sleep))
  if (!sameDay.length) return null
  // si hay varios registros ese día (siestas), nos quedamos con el más largo
  return sameDay.reduce((a, b) => (b.minutesAsleep > a.minutesAsleep ? b : a))
}

export async function getHRVForDate(token, dateStr, fresh = false) {
  const data = await healthFetch(
    `/dataTypes/daily-heart-rate-variability/dataPoints?filter=daily_heart_rate_variability.date >= "${dateStr}"`,
    token, fresh
  )
  const point = (data.dataPoints || []).find(
    p => p.dataSource?.platform === 'FITBIT' && pointDate(p.dailyHeartRateVariability?.date) === dateStr
  )
  if (!point) return null
  const hrv = point.dailyHeartRateVariability
  return {
    avgHRV: Math.round(hrv.averageHeartRateVariabilityMilliseconds),
    deepSleepRMSSD: Math.round(hrv.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds || 0),
    nonRemHR: hrv.nonRemHeartRateBeatsPerMinute ? parseInt(hrv.nonRemHeartRateBeatsPerMinute) : null,
  }
}

export async function getRHRForDate(token, dateStr, fresh = false) {
  const data = await healthFetch(
    `/dataTypes/daily-resting-heart-rate/dataPoints?filter=daily_resting_heart_rate.date >= "${dateStr}"`,
    token, fresh
  )
  const point = (data.dataPoints || []).find(
    p => p.dataSource?.platform === 'FITBIT' && pointDate(p.dailyRestingHeartRate?.date) === dateStr
  )
  if (!point) return null
  return { bpm: parseInt(point.dailyRestingHeartRate.beatsPerMinute) }
}

// FC intradiaria muestreada en cubos de 15 min: [{ mins, bpm }] con mins desde medianoche (Madrid)
export async function getHeartRateSeries(token, dateStr, fresh = false) {
  const off = madridOffset(dateStr)
  const offsetHours = parseInt(off.split(':')[0])
  
  // Convertir medianoche Madrid → UTC restando el offset
  const prevDay = new Date(`${dateStr}T00:00:00Z`)
  prevDay.setHours(prevDay.getHours() - offsetHours)
  const startUTC = prevDay.toISOString().replace('.000Z', 'Z')
  
  const endDay = new Date(`${dateStr}T00:00:00Z`)
  endDay.setHours(endDay.getHours() - offsetHours + 24)
  const endUTC = endDay.toISOString().replace('.000Z', 'Z')

  const dayStart = new Date(`${dateStr}T00:00:00${off}`).getTime()
  const buckets = new Map()
  let pageToken = null

  do {
    const base = `/dataTypes/heart-rate/dataPoints?filter=heart_rate.sample_time.physical_time >= "${startUTC}" AND heart_rate.sample_time.physical_time < "${endUTC}"&pageSize=10000`
    const qs = pageToken ? `${base}&pageToken=${pageToken}` : base
    const data = await healthFetch(qs, token, fresh)
    pageToken = data.nextPageToken || null

    for (const p of data.dataPoints || []) {
      const bpm = parseFloat(p.heartRate?.beatsPerMinute)
      const t = new Date(p.heartRate?.sampleTime?.physicalTime || 0).getTime()
      if (!bpm || !t) continue
      const mins = Math.floor((t - dayStart) / 60000)
      if (mins < 0 || mins > 1439) continue
      const slot = Math.floor(mins / 15) * 15
      const b = buckets.get(slot) || { sum: 0, n: 0 }
      b.sum += bpm
      b.n++
      buckets.set(slot, b)
    }
  } while (pageToken)

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([mins, { sum, n }]) => ({ mins, bpm: Math.round(sum / n) }))
}


export async function getDayData(token, dateStr, fresh = false) {
  const [sleep, hrv, rhr, heartRate] = await Promise.all([
    getSleepForDate(token, dateStr, fresh),
    getHRVForDate(token, dateStr, fresh),
    getRHRForDate(token, dateStr, fresh),
    // la FC intradiaria no debe tumbar el día entero si falla
    getHeartRateSeries(token, dateStr, fresh).catch(() => []),
  ])
  const readiness = calcReadinessScore({ sleep, hrv, rhr })
  const sleepRecovery = calcSleepRecovery({ sleep, hrv })
  const dailyStrain = calcDailyStrain({ heartRate, rhr, age: 20, sleep })
  return { sleep, hrv, rhr, heartRate, readiness, sleepRecovery, dailyStrain }
}

// Scores de los últimos 7 días (incluido hoy) para el selector de días
export async function getHistoryScores(token) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }))
  }
  const startStr = days[0]

  const [sleepData, hrvData, rhrData] = await Promise.all([
    healthFetch(
      `/dataTypes/sleep/dataPoints:reconcile?dataSourceFamily=users/me/dataSourceFamilies/google-wearables&filter=sleep.interval.civil_end_time >= "${startStr}"`,
      token
    ),
    healthFetch(
      `/dataTypes/daily-heart-rate-variability/dataPoints?filter=daily_heart_rate_variability.date >= "${startStr}"`,
      token
    ),
    healthFetch(
      `/dataTypes/daily-resting-heart-rate/dataPoints?filter=daily_resting_heart_rate.date >= "${startStr}"`,
      token
    ),
  ])

  const sleepByDay = {}
  for (const p of sleepData.dataPoints || []) {
    if (!p.sleep?.summary) continue
    const day = sleepEndDate(p.sleep)
    if (!day) continue
    const parsed = parseSleepPoint(p.sleep)
    if (!sleepByDay[day] || parsed.minutesAsleep > sleepByDay[day].minutesAsleep) sleepByDay[day] = parsed
  }

  const hrvByDay = {}
  for (const p of hrvData.dataPoints || []) {
    if (p.dataSource?.platform !== 'FITBIT') continue
    const day = pointDate(p.dailyHeartRateVariability?.date)
    if (day) hrvByDay[day] = { avgHRV: Math.round(p.dailyHeartRateVariability.averageHeartRateVariabilityMilliseconds) }
  }

  const rhrByDay = {}
  for (const p of rhrData.dataPoints || []) {
    if (p.dataSource?.platform !== 'FITBIT') continue
    const day = pointDate(p.dailyRestingHeartRate?.date)
    if (day) rhrByDay[day] = { bpm: parseInt(p.dailyRestingHeartRate.beatsPerMinute) }
  }

  return days.map(date => {
    const sleep = sleepByDay[date] || null
    const readiness = sleep
      ? calcReadinessScore({ sleep, hrv: hrvByDay[date] || null, rhr: rhrByDay[date] || null })
      : null
    return { date, readiness: readiness?.total ?? null }
  })
}

export function calcReadinessScore({ sleep, hrv, rhr }) {
  if (!sleep) return null

  const sleepGoalMin = 7.5 * 60
  const durationScore = Math.min(100, Math.round((sleep.minutesAsleep / sleepGoalMin) * 100))

  const deepPct = sleep.deep / sleep.minutesAsleep
  const deepScore = Math.min(100, Math.round((deepPct / 0.20) * 100))

  const remPct = sleep.rem / sleep.minutesAsleep
  const remScore = Math.min(100, Math.round((remPct / 0.22) * 100))

  const interruptionScore = Math.max(0, Math.round(100 - (sleep.minutesAwake / 5) * 10))

  const hrvScore = hrv ? Math.min(100, Math.round((hrv.avgHRV / 65) * 100)) : 60
  const rhrScore = rhr ? Math.max(0, Math.round(100 - ((rhr.bpm - 45) / 30) * 100)) : 60

  const total = Math.round(
    durationScore * 0.35 +
    deepScore * 0.20 +
    remScore * 0.15 +
    hrvScore * 0.15 +
    rhrScore * 0.10 +
    interruptionScore * 0.05
  )

  // subscore de sueño: componentes de sueño ponderados con sus pesos relativos (35+20+15+5)
  const sleepScore = Math.round(
    (durationScore * 35 + deepScore * 20 + remScore * 15 + interruptionScore * 5) / 75
  )

  return {
    total,
    sleepScore,
    breakdown: { durationScore, deepScore, remScore, hrvScore, rhrScore, interruptionScore },
  }
}

// Anillo de Recuperación del Sueño: qué tan reparador fue, no solo cuánto dormiste.
// Basado en los 4 pilares del sueño reparador (profundo, REM, continuidad, HRV nocturno).
export function calcSleepRecovery({ sleep, hrv }) {
  if (!sleep) return null

  // sueño profundo: restauración física — objetivo 90 min (percentil 75 adulto joven)
  const deepScore = Math.min(100, Math.round((sleep.deep / 90) * 100))
  // REM: consolidación cognitiva — objetivo 100 min
  const remScore = Math.min(100, Math.round((sleep.rem / 100) * 100))
  // continuidad: cada minuto despierto penaliza 3.5 puntos (la fragmentación pesa fuerte)
  const continuity = Math.max(0, Math.round(100 - sleep.minutesAwake * 3.5))
  // recuperación autonómica: preferimos el RMSSD de sueño profundo; si no, el HRV medio
  const hrvBoost = hrv?.deepSleepRMSSD
    ? Math.min(100, Math.round((hrv.deepSleepRMSSD / 70) * 100))
    : hrv?.avgHRV
      ? Math.min(100, Math.round((hrv.avgHRV / 60) * 100))
      : 60

  return Math.round(deepScore * 0.35 + remScore * 0.25 + continuity * 0.25 + hrvBoost * 0.15)
}

// Anillo de Esfuerzo Diario: carga cardiovascular del día a partir de la FC intradiaria.
// Metodología de zonas de entrenamiento (Firstbeat/Garmin) con FCmax de Tanaka.
export function calcDailyStrain({ heartRate, rhr, age = 20, sleep }) {
  if (!heartRate?.length) return null

  const hrMax = 208 - 0.7 * age
  const hrRest = rhr?.bpm || 64
  const hrReserve = hrMax - hrRest

  // El sueño cruza medianoche: startTime es del día anterior (>1200 mins)
  // endTime es del día actual (<600 mins)
  // Excluir buckets ANTES de sleepEnd (mañana) y DESPUÉS de sleepStart (noche)
  const sleepEnd = sleep
    ? Math.floor((new Date(sleep.endTime).getTime() - new Date(sleep.endTime.split('T')[0] + 'T00:00:00+02:00').getTime()) / 60000)
    : null
  const sleepStart = sleep
    ? Math.floor((new Date(sleep.startTime).getTime() - new Date(sleep.startTime.split('T')[0] + 'T00:00:00+02:00').getTime()) / 60000)
    : null

  let rawStrain = 0
  for (const { bpm, mins } of heartRate) {
  const duringSleepMorning = sleepEnd !== null && mins <= sleepEnd
  const duringSleepNight = sleepStart !== null && mins >= sleepStart
  if (duringSleepMorning || duringSleepNight) continue

  const pct = (bpm - hrRest) / hrReserve
  if (pct < 0.30) continue          // zona 1 ignorada completamente
  else if (pct < 0.50) rawStrain += 15 * 1.0
  else if (pct < 0.70) rawStrain += 15 * 2.5
  else if (pct < 0.85) rawStrain += 15 * 4.0
  else rawStrain += 15 * 6.0
}
console.log('STRAIN DEBUG:', {
  totalBuckets: heartRate.length,
  rawStrain,
  final: Math.min(100, Math.round((rawStrain / 130) * 100))
})

return Math.min(100, Math.round((rawStrain / 130) * 100))
}