'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ScoreRing from './ScoreRing'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceArea,
  Tooltip,
} from 'recharts'

function getStressLevelText(score) {
  if (score == null) return 'No disp.'
  if (score < 33) return 'Bajo'
  if (score < 66) return 'Medio'
  return 'Alto'
}

function getStressLevelColor(score) {
  if (score == null) return '#888'
  if (score < 33) return '#34c759' // Verde
  if (score < 66) return '#ffcc00' // Amarillo
  return '#ff3b30' // Naranja/Rojo
}

function getStressAdvice(score) {
  if (score == null) return 'No hay datos suficientes para calcular el nivel de estrés.'
  if (score < 33) return 'Tu nivel de Estrés es bajo. Tu cuerpo está en un estado óptimo de recuperación y relajación.'
  if (score < 66) return 'Tu nivel de Estrés está dentro de su rango normal. Asegúrate de hacer descansos de forma periódica para mantenerlo en un nivel óptimo.'
  return 'Tu nivel de Estrés es alto. Tu cuerpo está bajo carga fisiológica. Prioriza actividades relajantes, hidratación y buen descanso esta noche.'
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const val = payload[0].value
    return (
      <div style={{ background: '#1c1c1e', padding: '6px 12px', borderRadius: 8, border: '1px solid #333' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 'bold', color: '#fff' }}>
          Estrés: {val}
        </p>
      </div>
    )
  }
  return null
}

export default function StressClient() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load from cache first
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
    fetch(`/api/health?date=${date}`)
      .then(r => r.json())
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando datos de estrés...</div>
  }

  const stressData = data?.dailyStress
  const score = stressData?.score ?? null
  const series = stressData?.series ?? []
  
  // Calcular promedios del día para las tarjetas
  const rhr = data?.rhr?.bpm ?? '--'
  const hrv = data?.hrv?.avgHRV ?? '--'

  const scoreColor = getStressLevelColor(score)
  const scoreText = getStressLevelText(score)
  const advice = getStressAdvice(score)

  // Encontrar el rango de sueño en la serie para pintar el área azul
  // Como `isSleep` es true para los puntos de sueño, podemos crear start/end
  let sleepStart = null
  let sleepEnd = null
  for (let i = 0; i < series.length; i++) {
    if (series[i].isSleep) {
      if (!sleepStart) sleepStart = series[i].time
      sleepEnd = series[i].time
    } else if (sleepStart && !sleepEnd) {
      // Si el sueño se interrumpe, se podría hacer más complejo, 
      // pero asumimos un bloque de sueño principal por simplicidad.
    }
  }

  return (
    <main className="app stress-page">
      <header className="whoop-header" style={{ paddingBottom: 10 }}>
        <div className="whoop-header-top">
          <button className="whoop-icon-btn" onClick={() => router.back()} aria-label="Volver">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="whoop-brand" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            ESTRÉS
          </div>
          <div style={{ width: 24 }} /> {/* Spacer */}
        </div>
      </header>

      <div style={{ padding: '20px 16px' }}>
        {/* Gauge Circular */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30 }}>
          <ScoreRing
            score={score}
            size={180}
            strokeWidth={12}
            color={scoreColor}
            fontSize={52}
            fontWeight={800}
            label={scoreText}
            // Hacemos que el color del texto label también sea el del score
          />
        </div>

        {/* Tarjetas Media */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#1c1c1e', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8e8e93', fontSize: 12, fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              VFC media
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>
              {hrv} <span style={{ fontSize: 14, fontWeight: 500, color: '#8e8e93' }}>ms</span>
            </div>
          </div>
          
          <div style={{ background: '#1c1c1e', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8e8e93', fontSize: 12, fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              FC media
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>
              {rhr} <span style={{ fontSize: 14, fontWeight: 500, color: '#8e8e93' }}>ppm</span>
            </div>
          </div>
        </div>

        {/* Asesoramiento Personal */}
        <div style={{ background: '#1c1c1e', borderRadius: 16, padding: '16px', marginBottom: 30 }}>
          <div style={{ color: '#8e8e93', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Asesoramiento personal</div>
          <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.5 }}>
            {advice}
          </div>
        </div>

        {/* Gráfico de línea */}
        <div>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>ESTRÉS DE HOY</div>
          <div style={{ color: '#8e8e93', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>
            {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          <div style={{ height: 200, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="stressGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#34c759" stopOpacity={1} />    {/* Verde bajo */}
                    <stop offset="33%" stopColor="#34c759" stopOpacity={1} />   
                    <stop offset="34%" stopColor="#ffcc00" stopOpacity={1} />   {/* Amarillo medio */}
                    <stop offset="66%" stopColor="#ffcc00" stopOpacity={1} />
                    <stop offset="67%" stopColor="#ff3b30" stopOpacity={1} />   {/* Naranja alto */}
                    <stop offset="100%" stopColor="#ff3b30" stopOpacity={1} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: '#8e8e93', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={23} // Muestra etiquetas aprox cada 6h (24 * 15m = 6h)
                />
                <YAxis 
                  domain={[0, 100]} 
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fill: '#8e8e93', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {sleepStart && sleepEnd && (
                  <ReferenceArea 
                    x1={sleepStart} 
                    x2={sleepEnd} 
                    fill="#1e2a4f" 
                    fillOpacity={0.6}
                  />
                )}
                
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="url(#stressGradient)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </main>
  )
}
