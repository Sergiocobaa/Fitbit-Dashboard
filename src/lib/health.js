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

async function healthFetch(path, token, fresh = false, revalidate = 300) {
  const res = await fetch(`${HEALTH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    ...(fresh ? { cache: 'no-store' } : { next: { revalidate } }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Health API error ${res.status}: ${err}`)
  }
  return res.json()
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

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

  // Medianoche y fin de dateStr en Madrid
  const dayStartMadrid = new Date(`${dateStr}T00:00:00${off}`)
  const dayEndMadrid = new Date(`${dateStr}T23:59:59${off}`)

  // Para el filtro UTC: medianoche Madrid = UTC - offset
  const startUTC = dayStartMadrid.toISOString().slice(0, 19) + 'Z'
  const endUTC = dayEndMadrid.toISOString().slice(0, 19) + 'Z'

  const dayStartMs = dayStartMadrid.getTime()
  const buckets = new Map()
  let pageToken = null

  do {
    const base = `${HEALTH_BASE}/dataTypes/heart-rate/dataPoints?filter=heart_rate.sample_time.physical_time >= "${startUTC}" AND heart_rate.sample_time.physical_time < "${endUTC}"&pageSize=10000`
    const url = pageToken ? `${base}&pageToken=${pageToken}` : base
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (!res.ok) break
    const data = await res.json()
    pageToken = data.nextPageToken || null

    for (const p of data.dataPoints || []) {
      const bpm = parseFloat(p.heartRate?.beatsPerMinute)
      const t = new Date(p.heartRate?.sampleTime?.physicalTime || 0).getTime()
      if (!bpm || !t) continue
      // mins desde medianoche de dateStr en Madrid
      const mins = Math.floor((t - dayStartMs) / 60000)
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


// FCmax estimada (Tanaka): 208 - 0.7 * edad. Edad 20 → 194 bpm.
const FC_MAX = 208 - 0.7 * 20

function exerciseZoneOf(bpm, hrMax = FC_MAX) {
  const pct = bpm / hrMax
  if (pct < 0.5) return 'z1'
  if (pct < 0.6) return 'z2'
  if (pct < 0.7) return 'z3'
  if (pct < 0.8) return 'z4'
  return 'z5'
}

// Detalle completo de un entreno: metadatos + serie de FC del intervalo + zonas + stats.
// id es el dataPointName del Fitbit (o el startTime como fallback).
export async function getExerciseDetail(token, id) {
  // localizar el ejercicio por dataPointName entre los últimos ~95 días (cubre el período máx de 3 meses)
  const since = new Date()
  since.setDate(since.getDate() - 95)
  const filterDate = since.toISOString().split('T')[0]

  const exData = await healthFetch(
    `/dataTypes/exercise/dataPoints:reconcile?dataSourceFamily=users/me/dataSourceFamilies/google-wearables&filter=exercise.interval.civil_start_time >= "${filterDate}"`,
    token, true
  )
  const decodedId = decodeURIComponent(id)
  const point = (exData.dataPoints || []).find(
    p => p.name === decodedId
      || p.dataPointName === decodedId
      || p.exercise?.interval?.startTime === decodedId
  )
  if (!point?.exercise?.interval?.startTime) return null

  const ex = point.exercise
  const { startTime, endTime } = ex.interval
  const durationMinutes = Math.round((new Date(endTime) - new Date(startTime)) / 60000)
  const exercise = {
    name: ex.displayName || 'Entreno',
    type: ex.exerciseType || 'OTHER',
    startTime,
    endTime,
    durationMinutes,
    events: (ex.exerciseEvents || []).map(e => ({ type: e.exerciseEventType, time: e.eventTime })),
  }

  // FC del intervalo — sin paginación (un entreno tiene pocos puntos)
  const hrData = await healthFetch(
    `/dataTypes/heart-rate/dataPoints?filter=heart_rate.sample_time.physical_time >= "${startTime}" AND heart_rate.sample_time.physical_time < "${endTime}"&pageSize=10000`,
    token, true
  )
  const samples = (hrData.dataPoints || [])
    .map(p => ({
      bpm: parseFloat(p.heartRate?.beatsPerMinute),
      t: new Date(p.heartRate?.sampleTime?.physicalTime || 0).getTime(),
    }))
    .filter(s => s.bpm && s.t)
    .sort((a, b) => a.t - b.t)

  const heartRate = samples.map(s => ({
    time: new Date(s.t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' }),
    bpm: Math.round(s.bpm),
  }))

  // minutos por zona, proporcionales al nº de muestras
  const counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }
  for (const s of samples) counts[exerciseZoneOf(s.bpm)]++
  const totalSamples = samples.length || 1
  const zones = {}
  for (const z of ['z1', 'z2', 'z3', 'z4', 'z5']) {
    zones[z] = Math.round((durationMinutes * counts[z]) / totalSamples)
  }

  const bpms = samples.map(s => s.bpm)
  const stats = bpms.length
    ? {
        avgHR: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
        maxHR: Math.round(Math.max(...bpms)),
        minHR: Math.round(Math.min(...bpms)),
      }
    : { avgHR: null, maxHR: null, minHR: null }

  // RHR de ese día para la línea de referencia de la gráfica
  const dateStr = new Date(startTime).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  let restingHR = null
  try {
    const rhr = await getRHRForDate(token, dateStr)
    restingHR = rhr?.bpm ?? null
  } catch {
    /* opcional, la línea de referencia se omite si falla */
  }

  return { exercise, heartRate, zones, stats, restingHR, hrMax: FC_MAX }
}

// Baseline personal de los últimos 30 días (medias y desviaciones de HRV, RHR y sueño).
// Caché larga (revalidate 3600): no cambia cada 5 min y así no quemamos el rate limit.
export async function getBaseline(token) {
  const days = []
  for (let i = 30; i >= 1; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }))
  }
  const startStr = days[0]

  const [hrvData, rhrData, sleepData] = await Promise.all([
    healthFetch(`/dataTypes/daily-heart-rate-variability/dataPoints?filter=daily_heart_rate_variability.date >= "${startStr}"`, token, false, 3600),
    healthFetch(`/dataTypes/daily-resting-heart-rate/dataPoints?filter=daily_resting_heart_rate.date >= "${startStr}"`, token, false, 3600),
    healthFetch(`/dataTypes/sleep/dataPoints:reconcile?dataSourceFamily=users/me/dataSourceFamilies/google-wearables&filter=sleep.interval.civil_end_time >= "${startStr}"`, token, false, 3600),
  ])

  // HRV baseline — solo puntos Fitbit
  const hrvValues = hrvData.dataPoints
    ?.filter(p => p.dataSource?.platform === 'FITBIT')
    .map(p => p.dailyHeartRateVariability?.averageHeartRateVariabilityMilliseconds)
    .filter(Boolean) || []

  // RHR baseline — solo puntos Fitbit
  const rhrValues = rhrData.dataPoints
    ?.filter(p => p.dataSource?.platform === 'FITBIT')
    .map(p => parseInt(p.dailyRestingHeartRate?.beatsPerMinute))
    .filter(Boolean) || []

  // Sleep baseline — minutos dormidos por noche
  const sleepValues = sleepData.dataPoints
    ?.filter(p => p.sleep?.summary)
    .map(p => parseInt(p.sleep.summary.minutesAsleep))
    .filter(Boolean) || []

  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const std = (arr, mean) =>
    arr.length > 1 ? Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length) : null

  const hrvMean = avg(hrvValues)
  const rhrMean = avg(rhrValues)
  const sleepMean = avg(sleepValues)

  return {
    hrv: { mean: hrvMean, std: std(hrvValues, hrvMean), n: hrvValues.length },
    rhr: { mean: rhrMean, std: std(rhrValues, rhrMean), n: rhrValues.length },
    sleep: { mean: sleepMean, std: std(sleepValues, sleepMean), n: sleepValues.length },
  }
}

export async function getDayData(token, dateStr, fresh = false) {
  const sleep = await getSleepForDate(token, dateStr, fresh)
  await delay(200)
  const hrv = await getHRVForDate(token, dateStr, fresh)
  await delay(200)
  const rhr = await getRHRForDate(token, dateStr, fresh)
  await delay(200)
  const heartRate = await getHeartRateSeries(token, dateStr, fresh).catch(() => [])
  await delay(200)

  // si el baseline falla (rate limit, etc.) seguimos con null → umbrales fijos como fallback
  let baseline = null
  try {
    baseline = await getBaseline(token)
  } catch (err) {
    console.error('getBaseline falló, usando umbrales fijos:', err.message)
  }

  const readiness = calcReadinessScore({ sleep, hrv, rhr, baseline })
  const sleepRecovery = calcSleepRecovery({ sleep, hrv, rhr, heartRate, baseline })
  const dailyStrain = calcDailyStrain({ heartRate, rhr, age: 20, sleep })
 
  return { sleep, hrv, rhr, heartRate, readiness, sleepRecovery, dailyStrain, baseline }
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

export function calcReadinessScore({ sleep, hrv, rhr, baseline }) {
  if (!sleep) return null

  // --- Duración sueño vs baseline personal ---
  const sleepGoalMin = baseline?.sleep?.mean || 7.5 * 60
  const durationScore = Math.min(100, Math.round((sleep.minutesAsleep / sleepGoalMin) * 100))

  // --- Sueño profundo ---
  const deepPct = sleep.deep / sleep.minutesAsleep
  const deepScore = Math.min(100, Math.round((deepPct / 0.20) * 100))

  // --- REM ---
  const remPct = sleep.rem / sleep.minutesAsleep
  const remScore = Math.min(100, Math.round((remPct / 0.22) * 100))

  // --- Interrupciones ---
  const interruptionScore = Math.max(0, Math.round(100 - (sleep.minutesAwake / 5) * 10))

  // --- HRV vs baseline personal (z-score) ---
  let hrvScore = 60
  if (hrv && baseline?.hrv?.mean) {
    const mean = baseline.hrv.mean
    const std = baseline.hrv.std || mean * 0.15
    // z-score: cuántas desviaciones estándar está hoy vs tu media
    const z = (hrv.avgHRV - mean) / std
    // mapear z a 0-100: z=0 → 50, z=+2 → 100, z=-2 → 0
    hrvScore = Math.min(100, Math.max(0, Math.round(50 + z * 25)))
  } else if (hrv) {
    hrvScore = Math.min(100, Math.round((hrv.avgHRV / 65) * 100))
  }

  // --- RHR vs baseline personal (z-score invertido — RHR alta es malo) ---
  let rhrScore = 60
  if (rhr && baseline?.rhr?.mean) {
    const mean = baseline.rhr.mean
    const std = baseline.rhr.std || mean * 0.08
    const z = (rhr.bpm - mean) / std
    rhrScore = Math.min(100, Math.max(0, Math.round(50 - z * 25)))
  } else if (rhr) {
    rhrScore = Math.max(0, Math.round(100 - ((rhr.bpm - 45) / 30) * 100))
  }

  const total = Math.round(
    durationScore * 0.30 +
    deepScore * 0.15 +
    remScore * 0.10 +
    hrvScore * 0.25 +  // HRV vs baseline es el factor más importante
    rhrScore * 0.15 +  // RHR vs baseline segundo más importante
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
    baseline: baseline
      ? {
          hrvMean: baseline.hrv.mean != null ? Math.round(baseline.hrv.mean) : null,
          rhrMean: baseline.rhr.mean != null ? Math.round(baseline.rhr.mean) : null,
          sleepMeanMin: baseline.sleep.mean != null ? Math.round(baseline.sleep.mean) : null,
        }
      : null,
  }
}

// Anillo de Recuperación del Sueño: qué tan reparador fue, no solo cuánto dormiste.
// Basado en los 4 pilares del sueño reparador (profundo, REM, continuidad, HRV nocturno).
export function calcSleepRecovery({ sleep, hrv, rhr, heartRate, baseline }) {
  if (!sleep) return null

  // --- 1. Sueño profundo ---
  const deepScore = Math.min(100, Math.round((sleep.deep / 90) * 100))

  // --- 2. REM ---
  const remScore = Math.min(100, Math.round((sleep.rem / 100) * 100))

  // --- 3. Continuidad ---
  const continuity = Math.max(0, Math.round(100 - (sleep.minutesAwake * 3.5)))

  // --- 4. HRV vs baseline personal ---
  let hrvBoost = 50
  if (hrv && baseline?.hrv?.mean) {
    const mean = baseline.hrv.mean
    const std = baseline.hrv.std || mean * 0.15
    const z = ((hrv.deepSleepRMSSD || hrv.avgHRV) - mean) / std
    hrvBoost = Math.min(100, Math.max(0, Math.round(50 + z * 25)))
  } else if (hrv) {
    hrvBoost = Math.min(100, Math.round(((hrv.deepSleepRMSSD || hrv.avgHRV) / 65) * 100))
  }

  // --- 5. FC nocturna vs RHR baseline ---
  // Extraer puntos de FC durante las horas de sueño
  // sleep.startTime y sleep.endTime son ISO strings UTC
  let nocturnalHRScore = 50 // neutro si no hay datos
  if (heartRate?.length && sleep?.startTime && sleep?.endTime) {
    const sleepStartMs = new Date(sleep.startTime).getTime()
    const sleepEndMs = new Date(sleep.endTime).getTime()
    const totalSleepMs = sleepEndMs - sleepStartMs

    // Solo las primeras 3 horas de sueño (más relevantes para recuperación)
    const firstThirdMs = sleepStartMs + Math.min(totalSleepMs * 0.33, 3 * 60 * 60 * 1000)

    // heartRate array tiene { mins, bpm } donde mins es desde medianoche Madrid
    // Necesitamos convertir sleepStart a minutos desde medianoche Madrid
    const madridMidnight = new Date(sleep.startTime.split('T')[0] + 'T00:00:00+02:00').getTime()
    const sleepStartMins = Math.floor((sleepStartMs - madridMidnight) / 60000)
    const firstThirdMins = Math.floor((firstThirdMs - madridMidnight) / 60000)

    // Si el sueño empieza antes de medianoche (ej: 23:11 = mins negativos o >1380)
    // ajustar: si sleepStartMins > 1200, restar 1440 (día anterior)
    const startMins = sleepStartMins > 1200 ? sleepStartMins - 1440 : sleepStartMins
    const endMins = firstThirdMins > 1200 ? firstThirdMins - 1440 : firstThirdMins

    const nocturnalPoints = heartRate.filter(p => {
      const m = p.mins > 1200 ? p.mins - 1440 : p.mins
      return m >= startMins && m <= endMins
    })

    if (nocturnalPoints.length >= 3) {
      const avgNocturnalHR = nocturnalPoints.reduce((a, b) => a + b.bpm, 0) / nocturnalPoints.length
      const rhrBaseline = baseline?.rhr?.mean || rhr?.bpm || 65
      const rhrStd = baseline?.rhr?.std || rhrBaseline * 0.08

      // Cuánto por encima del RHR baseline está la FC nocturna
      // FC nocturna idealmente debería ser similar o menor al RHR
      // Si FC nocturna > RHR + 1std → mala recuperación
      const z = (avgNocturnalHR - rhrBaseline) / rhrStd
      // z=0 (FC nocturna = RHR baseline) → 70 puntos (bueno)
      // z=+2 (FC nocturna muy elevada) → 20 puntos (malo)
      // z=-1 (FC nocturna < RHR) → 95 puntos (excelente)
      nocturnalHRScore = Math.min(100, Math.max(0, Math.round(70 - z * 25)))

    }
  }

  // Pesos finales:
  // FC nocturna es el factor más importante (35%) — lo que Bevel prioriza
  // HRV vs baseline (30%) — recuperación autonómica
  // Continuidad (15%) — fragmentación del sueño
  // Sueño profundo (12%) — restauración física
  // REM (8%) — consolidación cognitiva
  const result = Math.round(
      nocturnalHRScore * 0.50 +  // subido de 0.35 a 0.50
      hrvBoost         * 0.30 +
      continuity       * 0.10 +  // bajado de 0.15
      deepScore        * 0.06 +  // bajado de 0.12
      remScore         * 0.04    // bajado de 0.08
  )

  return result
}

// Anillo de Esfuerzo Diario: carga cardiovascular del día a partir de la FC intradiaria.
// Metodología de zonas de entrenamiento (Firstbeat/Garmin) con FCmax de Tanaka.
//
// Zonas por % de FC de reserva (Karvonen):
//   < 0.05  → en reposo total (sedentario)
//   0.05-0.20 → actividad muy ligera (caminar despacio, tareas del hogar)  ← mall walk aquí
//   0.20-0.40 → baja intensidad (caminar rápido, ciclismo suave)
//   0.40-0.60 → moderada (trote, bici)
//   0.60-0.75 → intensa (carrera, cardio)
//   0.75-0.88 → muy intensa (HIIT, umbral)
//   > 0.88   → máxima (sprint)
export function calcDailyStrain({ heartRate, rhr, age = 20, sleep }) {
  if (!heartRate?.length) return 0

  const hrMax = 208 - 0.7 * age
  const hrRest = rhr?.bpm || 64
  const hrReserve = hrMax - hrRest

  // Solo excluir el período de sueño: desde el inicio hasta el final
  // El sueño cruza medianoche, así que en el array de FC del día actual
  // los buckets de madrugada (0 a sleepEnd) son de sueño
  const sleepEnd = sleep
    ? Math.floor((new Date(sleep.endTime).getTime() - new Date(sleep.endTime.split('T')[0] + 'T00:00:00+02:00').getTime()) / 60000)
    : null

  // Para el inicio del sueño nocturno: solo excluir si es después de las 20:00 (min > 1200)
  const sleepStartRaw = sleep
    ? Math.floor((new Date(sleep.startTime).getTime() - new Date(sleep.startTime.split('T')[0] + 'T00:00:00+02:00').getTime()) / 60000)
    : null
  const sleepStart = sleepStartRaw !== null && sleepStartRaw > 1200 ? sleepStartRaw : null

  let rawStrain = 0
  let activePoints = 0
  for (const { bpm, mins } of heartRate) {
    const duringSleepMorning = sleepEnd !== null && mins <= sleepEnd
    const duringSleepNight = sleepStart !== null && mins >= sleepStart
    if (duringSleepMorning || duringSleepNight) continue

    activePoints++
    const pct = (bpm - hrRest) / hrReserve
    
    // Zonas calibradas para que un paseo de 2h de ~20-25% y 1h de running de ~70-80%
    if      (pct < 0.12) continue                  // sedentario/reposo (< 80 bpm) — no suma
    else if (pct < 0.25) rawStrain += 15 * 0.15    // muy ligera (mall walk) -> 2.25 pts por bucket
    else if (pct < 0.40) rawStrain += 15 * 0.50    // ligera (caminar rápido) -> 7.5 pts
    else if (pct < 0.60) rawStrain += 15 * 1.00    // moderada (trote) -> 15 pts
    else if (pct < 0.80) rawStrain += 15 * 1.80    // intensa (carrera) -> 27 pts
    else                 rawStrain += 15 * 3.00    // máxima -> 45 pts
  }

  if (activePoints === 0) return 0

  // Ya no usamos divisor de 60, rawStrain acumula directamente puntos porcentuales
  return Math.min(100, Math.round(rawStrain))
}