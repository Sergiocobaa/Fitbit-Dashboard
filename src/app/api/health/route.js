import { getAccessToken, getDayData, todayMadrid } from '@/lib/health'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || todayMadrid()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'Parámetro date inválido, formato YYYY-MM-DD' }, { status: 400 })
    }
    const fresh = searchParams.get('fresh') === '1'

    const token = await getAccessToken()
    const data = await getDayData(token, date, fresh)

    return Response.json({ date, ...data })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
