import { getAccessToken, getExerciseDetail } from '@/lib/health'

export async function GET(request, { params }) {
  try {
    const { id } = await params
    // catch-all: el id puede contener "/" (dataPointName); Next ya decodifica cada segmento
    const exerciseId = Array.isArray(id) ? id.join('/') : id

    const token = await getAccessToken()
    const detail = await getExerciseDetail(token, exerciseId)
    if (!detail) return Response.json({ error: 'Entreno no encontrado' }, { status: 404 })

    return Response.json(detail)
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
