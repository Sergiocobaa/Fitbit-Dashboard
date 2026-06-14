import { getAccessToken } from '@/lib/health'

const HEALTH_BASE = 'https://health.googleapis.com/v4/users/me'

// fecha local del ejercicio aplicando el offset UTC que reporta Fitbit ("7200s")
function localDate(startTime, utcOffset) {
  const offsetSec = parseInt(utcOffset) || 0
  const shifted = new Date(new Date(startTime).getTime() + offsetSec * 1000)
  return shifted.toISOString().split('T')[0]
}

export async function GET(request) {
  try {
    const token = await getAccessToken()

    // periodo dinámico: ?days=7 | 30 | 90 (por defecto 30)
    const { searchParams } = new URL(request.url)
    const days = Math.min(366, Math.max(1, parseInt(searchParams.get('days')) || 30))

    const date30DaysAgo = new Date()
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30)
    const startDate = date30DaysAgo.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })

    const url = `https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints:reconcile?filter=exercise.interval.civil_start_time >= "${startDate}"`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Health API error ${res.status}: ${err}`)
    }
    const data = await res.json()

    const exercises = (data.dataPoints || [])
      .filter(p => p.exercise?.interval?.startTime && p.exercise?.interval?.endTime)
      .map(p => {
        const ex = p.exercise
        const { startTime, endTime, startUtcOffset } = ex.interval
        return {
          id: p.name || startTime,
          name: ex.displayName || 'Entreno',
          type: ex.exerciseType || 'OTHER',
          startTime,
          endTime,
          durationMinutes: Math.round((new Date(endTime) - new Date(startTime)) / 60000),
          date: localDate(startTime, startUtcOffset),
          events: (ex.exerciseEvents || []).map(e => ({
            type: e.exerciseEventType,
            time: e.eventTime,
          })),
          source: 'fitbit',
        }
      })
      .sort((a, b) => b.startTime.localeCompare(a.startTime))

    return Response.json({ exercises })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
