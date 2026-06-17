import { getAccessToken, getAccessToken as _ga, getDayData, todayMadrid, getHistoryScores, getHRVForDate, getRHRForDate, getSleepForDate, calcReadinessScore } from '@/lib/health'

/**
 * GET /api/health/trends?period=7|30|180
 * Devuelve N días de HRV, RHR, sleep (minutos) y readiness para las gráficas de tendencias.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = Math.min(180, Math.max(7, parseInt(searchParams.get('period') || '7')))

    const token = await getAccessToken()

    // Construir array de fechas
    const days = []
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }))
    }
    const startStr = days[0]

    // Fetch paralelo de HRV, RHR y sueño
    const [hrvData, rhrData, sleepData] = await Promise.all([
      fetch(`https://health.googleapis.com/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints?filter=daily_heart_rate_variability.date >= "${startStr}"`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 900 },
      }).then(r => r.json()).catch(() => ({ dataPoints: [] })),

      fetch(`https://health.googleapis.com/v4/users/me/dataTypes/daily-resting-heart-rate/dataPoints?filter=daily_resting_heart_rate.date >= "${startStr}"`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 900 },
      }).then(r => r.json()).catch(() => ({ dataPoints: [] })),

      fetch(`https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints:reconcile?dataSourceFamily=users/me/dataSourceFamilies/google-wearables&filter=sleep.interval.civil_end_time >= "${startStr}"`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 900 },
      }).then(r => r.json()).catch(() => ({ dataPoints: [] })),
    ])

    // Indexar por fecha
    const hrvByDay = {}
    for (const p of hrvData.dataPoints || []) {
      if (p.dataSource?.platform !== 'FITBIT') continue
      const date = p.dailyHeartRateVariability?.date
      const d = date?.year
        ? `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
        : typeof date === 'string' ? date.split('T')[0] : null
      if (d) hrvByDay[d] = Math.round(p.dailyHeartRateVariability.averageHeartRateVariabilityMilliseconds)
    }

    const rhrByDay = {}
    for (const p of rhrData.dataPoints || []) {
      if (p.dataSource?.platform !== 'FITBIT') continue
      const date = p.dailyRestingHeartRate?.date
      const d = date?.year
        ? `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
        : typeof date === 'string' ? date.split('T')[0] : null
      if (d) rhrByDay[d] = parseInt(p.dailyRestingHeartRate.beatsPerMinute)
    }

    const sleepByDay = {}
    for (const p of sleepData.dataPoints || []) {
      if (!p.sleep?.summary) continue
      const endDate = p.sleep?.interval?.civilEndTime || p.sleep?.interval?.endTime
      const d = endDate
        ? (typeof endDate === 'string' ? endDate.split('T')[0] : null)
        : null
      if (!d) continue
      const mins = parseInt(p.sleep.summary.minutesAsleep)
      if (!sleepByDay[d] || mins > sleepByDay[d]) sleepByDay[d] = mins
    }

    // Calcular baseline (últimos 30 días dentro de los datos que tenemos)
    const hrvValues = Object.values(hrvByDay).filter(Boolean)
    const rhrValues = Object.values(rhrByDay).filter(Boolean)
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
    const stdDev = (arr, mean) => arr.length > 1
      ? Math.round(Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length))
      : null

    const hrvMean = avg(hrvValues)
    const rhrMean = avg(rhrValues)
    const hrvStd = stdDev(hrvValues, hrvMean)
    const rhrStd = stdDev(rhrValues, rhrMean)

    const result = days.map(date => ({
      date,
      hrv: hrvByDay[date] ?? null,
      rhr: rhrByDay[date] ?? null,
      sleep: sleepByDay[date] ?? null,
    }))

    return Response.json({
      days: result,
      baseline: {
        hrv: { mean: hrvMean, std: hrvStd },
        rhr: { mean: rhrMean, std: rhrStd },
      },
    })
  } catch (err) {
    console.error('[trends]', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
