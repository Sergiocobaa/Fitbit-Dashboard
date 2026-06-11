import { getAccessToken } from '@/lib/health'

const HEALTH_BASE = 'https://health.googleapis.com/v4/users/me'

// fecha local del ejercicio aplicando el offset UTC que reporta Fitbit ("7200s")
function localDate(startTime, utcOffset) {
  const offsetSec = parseInt(utcOffset) || 0
  const shifted = new Date(new Date(startTime).getTime() + offsetSec * 1000)
  return shifted.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const token = await getAccessToken()

    const since = new Date()
    since.setDate(since.getDate() - 30)
    const filterDate = since.toISOString().split('T')[0]

    const url =
      `${HEALTH_BASE}/dataTypes/exercise/dataPoints:reconcile` +
      `?dataSourceFamily=users/me/dataSourceFamilies/google-wearables` +
      `&filter=exercise.interval.civil_start_time >= "${filterDate}"`

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
