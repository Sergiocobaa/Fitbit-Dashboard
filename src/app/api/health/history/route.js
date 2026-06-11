import { getAccessToken, getHistoryScores } from '@/lib/health'

export async function GET() {
  try {
    const token = await getAccessToken()
    const days = await getHistoryScores(token)
    return Response.json({ days })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
