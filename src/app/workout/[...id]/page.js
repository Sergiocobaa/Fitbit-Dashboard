import { getAccessToken, getExerciseDetail } from '@/lib/health'
import WorkoutDetail from '@/components/WorkoutDetail'

export const dynamic = 'force-dynamic'

export default async function WorkoutDetailPage({ params }) {
  const { id } = await params
  const exerciseId = Array.isArray(id) ? id.join('/') : id

  let detail = null
  try {
    const token = await getAccessToken()
    detail = await getExerciseDetail(token, exerciseId)
  } catch (err) {
    console.error('Error cargando detalle de entreno:', err.message)
  }

  return <WorkoutDetail detail={detail} />
}
