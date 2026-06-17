import { NextResponse } from 'next/server'

/**
 * POST /api/ai-insight
 *
 * Modo diario (default):
 *   { sleep, readiness, hrv, rhr, date }
 *   → Análisis del sueño de anoche
 *
 * Modo semanal:
 *   { mode: 'weekly', days: [{ date, hrv, rhr, sleep, readiness }], baseline }
 *   → Resumen y recomendaciones de la semana completa
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

  // ── Modo semanal ─────────────────────────────────────────────────────────────
  if (body.mode === 'weekly') {
    return handleWeekly(body, apiKey)
  }

  // ── Modo diario (default) ─────────────────────────────────────────────────────
  return handleDaily(body, apiKey)
}

async function handleWeekly({ days, baseline }, apiKey) {
  if (!days?.length) {
    return NextResponse.json({ error: 'Se necesitan datos de los días' }, { status: 400 })
  }

  const lines = ['Resumen de la semana:']
  for (const d of days) {
    const parts = [`• ${d.date}:`]
    if (d.hrv != null)       parts.push(`HRV ${d.hrv}ms`)
    if (d.rhr != null)       parts.push(`FC reposo ${d.rhr}bpm`)
    if (d.sleep != null)     parts.push(`Sueño ${Math.floor(d.sleep / 60)}h ${d.sleep % 60}m`)
    if (d.readiness != null) parts.push(`Score ${d.readiness}/100`)
    lines.push(parts.join(' '))
  }
  if (baseline?.hrv?.mean)  lines.push(`\nTu HRV media de referencia: ${Math.round(baseline.hrv.mean)} ms`)
  if (baseline?.rhr?.mean)  lines.push(`Tu FC reposo de referencia: ${Math.round(baseline.rhr.mean)} bpm`)

  const systemPrompt = `Eres un coach de salud experto. Analizas datos semanales de smartwatch y das un resumen conciso y accionable en español.
Responde SIEMPRE en JSON con este formato exacto:
{
  "title": "Título corto del resumen semanal (máx 7 palabras)",
  "body": "Análisis de 2-3 frases destacando la tendencia principal de la semana.",
  "tip": "Una recomendación específica y práctica para la próxima semana."
}`

  return callOpenAI(lines.join('\n'), systemPrompt, apiKey)
}

async function handleDaily({ sleep, readiness, hrv, rhr, date }, apiKey) {
  const lines = []

  if (date) lines.push(`Fecha: ${date}`)

  if (sleep) {
    const h = Math.floor((sleep.minutesAsleep ?? 0) / 60)
    const m = (sleep.minutesAsleep ?? 0) % 60
    lines.push(`Sueño total: ${h}h ${m}min`)
    if (sleep.deep != null)         lines.push(`Sueño profundo: ${Math.floor(sleep.deep / 60)}h ${sleep.deep % 60}min`)
    if (sleep.rem != null)          lines.push(`Sueño REM: ${Math.floor(sleep.rem / 60)}h ${sleep.rem % 60}min`)
    if (sleep.light != null)        lines.push(`Sueño ligero: ${Math.floor(sleep.light / 60)}h ${sleep.light % 60}min`)
    if (sleep.minutesAwake != null) lines.push(`Tiempo despierto: ${sleep.minutesAwake} min`)
    if (sleep.efficiency != null)   lines.push(`Eficiencia del sueño: ${sleep.efficiency}%`)
    if (sleep.startTime)            lines.push(`Hora de acostarse: ${new Date(sleep.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
    if (sleep.endTime)              lines.push(`Hora de despertarse: ${new Date(sleep.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
  }

  if (readiness) {
    if (readiness.total != null)      lines.push(`Score de preparación: ${readiness.total}/100`)
    if (readiness.sleepScore != null) lines.push(`Score de sueño: ${readiness.sleepScore}/100`)
    if (readiness.baseline?.hrvMean)  lines.push(`HRV media de referencia: ${readiness.baseline.hrvMean} ms`)
    if (readiness.baseline?.rhrMean)  lines.push(`FC reposo media de referencia: ${readiness.baseline.rhrMean} bpm`)
  }

  if (hrv?.avgHRV != null) lines.push(`HRV anoche: ${hrv.avgHRV} ms`)
  if (rhr?.bpm != null)    lines.push(`Frecuencia cardíaca en reposo: ${rhr.bpm} bpm`)

  const systemPrompt = `Eres un coach de salud y sueño personal experto. 
Analizas datos de un smartwatch (Fitbit/Google Fit) y ofreces un análisis breve, directo y personalizado en español.
Tu tono es profesional pero cercano, como el de la app WHOOP.
Responde SIEMPRE en JSON con este formato exacto:
{
  "title": "Título corto y descriptivo (máx 8 palabras)",
  "body": "Análisis de 2-3 frases con observaciones concretas y accionables basadas en los datos.",
  "tip": "Un consejo práctico de 1 frase para mejorar el sueño o el rendimiento hoy."
}`

  return callOpenAI(lines.join('\n'), systemPrompt, apiKey)
}

// ── Helper compartido: llama a OpenAI y devuelve NextResponse ────────────────
async function callOpenAI(userContent, systemPrompt, apiKey) {
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
          { role: 'user',   content: userContent },
        ],
        max_tokens: 300,
        temperature: 0.65,
        response_format: { type: 'json_object' },
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json()
      console.error('[ai-insight] OpenAI error:', err)
      return NextResponse.json({ error: err.error?.message ?? 'OpenAI error' }, { status: openaiRes.status })
    }

    const result = await openaiRes.json()
    const content = result.choices?.[0]?.message?.content

    let parsed
    try { parsed = JSON.parse(content) }
    catch { return NextResponse.json({ error: 'Respuesta de IA inválida' }, { status: 500 }) }

    const usage = result.usage
    const cost = usage
      ? ((usage.prompt_tokens * 0.15 + usage.completion_tokens * 0.60) / 1_000_000)
      : null

    return NextResponse.json({
      title:     parsed.title ?? 'Análisis de sueño',
      body:      parsed.body  ?? '',
      tip:       parsed.tip   ?? '',
      _tokens:   usage?.total_tokens,
      _cost_usd: cost ? parseFloat(cost.toFixed(6)) : null,
    })
  } catch (err) {
    console.error('[ai-insight] fetch error:', err)
    return NextResponse.json({ error: 'Error de red con OpenAI' }, { status: 500 })
  }
}
