import { NextResponse } from 'next/server'

/**
 * POST /api/ai-insight
 * Genera un análisis personalizado del sueño usando GPT-4o mini.
 * Se llama solo cuando hay datos nuevos — el cliente cachea la respuesta
 * en localStorage para no repetir llamadas.
 */
export async function POST(req) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { sleep, readiness, hrv, rhr, date } = body

  // ── Construir contexto de salud para el prompt ──────────────────────────────
  const lines = []

  if (date) lines.push(`Fecha: ${date}`)

  if (sleep) {
    const h = Math.floor((sleep.minutesAsleep ?? 0) / 60)
    const m = (sleep.minutesAsleep ?? 0) % 60
    lines.push(`Sueño total: ${h}h ${m}min`)
    if (sleep.deep != null)      lines.push(`Sueño profundo: ${Math.floor(sleep.deep / 60)}h ${sleep.deep % 60}min`)
    if (sleep.rem != null)       lines.push(`Sueño REM: ${Math.floor(sleep.rem / 60)}h ${sleep.rem % 60}min`)
    if (sleep.light != null)     lines.push(`Sueño ligero: ${Math.floor(sleep.light / 60)}h ${sleep.light % 60}min`)
    if (sleep.minutesAwake != null) lines.push(`Tiempo despierto: ${sleep.minutesAwake} min`)
    if (sleep.efficiency != null) lines.push(`Eficiencia del sueño: ${sleep.efficiency}%`)
    if (sleep.startTime)         lines.push(`Hora de acostarse: ${new Date(sleep.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
    if (sleep.endTime)           lines.push(`Hora de despertarse: ${new Date(sleep.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
  }

  if (readiness) {
    if (readiness.total != null)      lines.push(`Score de preparación: ${readiness.total}/100`)
    if (readiness.sleepScore != null) lines.push(`Score de sueño: ${readiness.sleepScore}/100`)
    if (readiness.baseline?.hrvMean)  lines.push(`HRV media de referencia: ${readiness.baseline.hrvMean} ms`)
    if (readiness.baseline?.rhrMean)  lines.push(`FC reposo media de referencia: ${readiness.baseline.rhrMean} bpm`)
  }

  if (hrv?.avgHRV != null)  lines.push(`HRV anoche: ${hrv.avgHRV} ms`)
  if (rhr?.bpm != null)     lines.push(`Frecuencia cardíaca en reposo: ${rhr.bpm} bpm`)

  const dataContext = lines.join('\n')

  // ── Llamada a OpenAI ────────────────────────────────────────────────────────
  const systemPrompt = `Eres un coach de salud y sueño personal experto. 
Analizas datos de un smartwatch (Fitbit/Google Fit) y ofreces un análisis breve, directo y personalizado en español.
Tu tono es profesional pero cercano, como el de la app WHOOP.
Responde SIEMPRE en JSON con este formato exacto:
{
  "title": "Título corto y descriptivo (máx 8 palabras)",
  "body": "Análisis de 2-3 frases con observaciones concretas y accionables basadas en los datos.",
  "tip": "Un consejo práctico de 1 frase para mejorar el sueño o el rendimiento hoy."
}`

  const userPrompt = `Analiza estos datos de salud de anoche y hoy:\n\n${dataContext}\n\nGenera el análisis JSON.`

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 250,
        temperature: 0.65,
        response_format: { type: 'json_object' },
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json()
      console.error('[ai-insight] OpenAI error:', err)
      return NextResponse.json(
        { error: err.error?.message ?? 'OpenAI error' },
        { status: openaiRes.status }
      )
    }

    const result = await openaiRes.json()
    const content = result.choices?.[0]?.message?.content

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'Respuesta de IA inválida' }, { status: 500 })
    }

    // Incluir uso de tokens para monitoring (opcional)
    const usage = result.usage
    const cost = usage
      ? ((usage.prompt_tokens * 0.15 + usage.completion_tokens * 0.60) / 1_000_000)
      : null

    return NextResponse.json({
      title: parsed.title ?? 'Análisis de sueño',
      body:  parsed.body  ?? '',
      tip:   parsed.tip   ?? '',
      _tokens: usage?.total_tokens,
      _cost_usd: cost ? parseFloat(cost.toFixed(6)) : null,
    })
  } catch (err) {
    console.error('[ai-insight] fetch error:', err)
    return NextResponse.json({ error: 'Error de red con OpenAI' }, { status: 500 })
  }
}
