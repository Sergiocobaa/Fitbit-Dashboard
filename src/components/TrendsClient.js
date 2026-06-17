'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Dot,
} from 'recharts'

const PERIODS = [
  { label: 'S', value: 7 },
  { label: 'M', value: 30 },
  { label: '6M', value: 180 },
]

const METRICS = [
  { key: 'hrv',   label: 'HRV',          unit: 'ms',  color: '#4a9eff', higherIsBetter: true  },
  { key: 'sleep', label: 'Sueño',         unit: 'min', color: '#8b7fd4', higherIsBetter: true  },
  { key: 'rhr',   label: 'FC Reposo',     unit: 'bpm', color: '#ff5a5a', higherIsBetter: false },
]

function fmtSleep(mins) {
  if (!mins) return '--'
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function fmtDate(dateStr, period) {
  const d = new Date(`${dateStr}T12:00:00`)
  if (period <= 7)  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
  if (period <= 30) return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label, metric, period }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  const display = metric.key === 'sleep' ? fmtSleep(val) : (val != null ? `${val} ${metric.unit}` : '--')
  return (
    <div style={{
      background: 'rgba(17,24,39,0.97)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: metric.color, fontWeight: 700, fontSize: 15 }}>{display}</div>
    </div>
  )
}

export default function TrendsClient() {
  const [period, setPeriod] = useState(7)
  const [metricKey, setMetricKey] = useState('hrv')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const metric = METRICS.find(m => m.key === metricKey)

  const load = useCallback((p) => {
    setLoading(true)
    setError(null)
    fetch(`/api/health/trends?period=${p}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(period) }, [period, load])

  const chartData = (data?.days ?? [])
    .map(d => ({
      date: fmtDate(d.date, period),
      rawDate: d.date,
      value: d[metricKey],
    }))
    .filter((_, i, arr) => period <= 30 || i % Math.ceil(arr.length / 30) === 0) // downsample for 6M

  const baseline = data?.baseline?.[metricKey]
  const hasBaseline = baseline?.mean != null && baseline?.std != null
  const rangeLow  = hasBaseline ? Math.round(baseline.mean - baseline.std) : null
  const rangeHigh = hasBaseline ? Math.round(baseline.mean + baseline.std) : null

  // Stats del período
  const values = chartData.map(d => d.value).filter(v => v != null)
  const periodAvg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
  const lastVal = values[values.length - 1]
  const prevVal = values[values.length - 2]
  const vsLast = lastVal != null && prevVal != null
    ? Math.round(((lastVal - prevVal) / prevVal) * 10) / 10
    : null

  const vsBaselinePct = periodAvg != null && baseline?.mean
    ? Math.round(((periodAvg - baseline.mean) / baseline.mean) * 100)
    : null

  return (
    <main className="app">
      {/* Header */}
      <div className="trends-header">
        <h1 className="trends-title">TENDENCIAS</h1>

        {/* Selector de período */}
        <div className="trends-period-tabs">
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`trends-period-btn${period === p.value ? ' active' : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de métrica */}
      <div className="trends-metric-tabs">
        {METRICS.map(m => (
          <button
            key={m.key}
            className={`trends-metric-btn${metricKey === m.key ? ' active' : ''}`}
            style={metricKey === m.key ? { borderColor: m.color, color: m.color } : {}}
            onClick={() => setMetricKey(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Stats rápidas */}
      {!loading && periodAvg != null && (
        <div className="trends-stats">
          <div>
            <div className="trends-stat-label">PROMEDIO</div>
            <div className="trends-stat-value" style={{ color: metric.color }}>
              {metric.key === 'sleep' ? fmtSleep(periodAvg) : `${periodAvg}`}
              <span className="trends-stat-unit"> {metric.key !== 'sleep' ? metric.unit : ''}</span>
            </div>
            {vsBaselinePct != null && (
              <div className="trends-stat-delta" style={{
                color: (metric.higherIsBetter ? vsBaselinePct > 0 : vsBaselinePct < 0) ? 'var(--green)' : Math.abs(vsBaselinePct) < 3 ? 'var(--muted)' : 'var(--red)',
              }}>
                {vsBaselinePct > 0 ? '↑' : '↓'} {Math.abs(vsBaselinePct)}% vs. tu media
              </div>
            )}
          </div>
          {hasBaseline && (
            <div style={{ textAlign: 'right' }}>
              <div className="trends-stat-label">■ RANGO TÍPICO</div>
              <div className="trends-stat-value" style={{ fontSize: 15, color: 'var(--muted)' }}>
                {metric.key === 'sleep' ? `${fmtSleep(rangeLow)} – ${fmtSleep(rangeHigh)}` : `${rangeLow} – ${rangeHigh} ${metric.unit}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gráfico */}
      <div className="trends-chart-wrap card">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />

              {/* Rango típico sombreado */}
              {hasBaseline && rangeLow != null && rangeHigh != null && (
                <ReferenceArea
                  y1={rangeLow}
                  y2={rangeHigh}
                  fill="rgba(255,255,255,0.04)"
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 4"
                />
              )}

              {/* Línea de media */}
              {hasBaseline && (
                <ReferenceLine
                  y={Math.round(baseline.mean)}
                  stroke="rgba(255,255,255,0.2)"
                  strokeDasharray="4 4"
                />
              )}

              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={period <= 7 ? 0 : period <= 30 ? 4 : 'preserveStartEnd'}
              />
              <YAxis
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip metric={metric} period={period} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={metric.color}
                strokeWidth={2.5}
                dot={(props) => {
                  if (props.payload?.value == null) return null
                  return <Dot {...props} r={3} fill={metric.color} strokeWidth={0} />
                }}
                activeDot={{ r: 5, fill: metric.color, strokeWidth: 0 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Descripción de la métrica */}
      <section className="card" style={{ marginTop: 0 }}>
        <div className="hm-section-label" style={{ marginBottom: 8 }}>
          {metric.label.toUpperCase()}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          {metricKey === 'hrv' && 'La variabilidad de la frecuencia cardíaca (HRV) refleja la variación en el tiempo entre latidos. Es una señal clave de cómo tu sistema nervioso equilibra el estrés y la recuperación. Un HRV alto suele asociarse a mejor recuperación y mayor resiliencia.'}
          {metricKey === 'sleep' && 'El tiempo total de sueño es fundamental para la recuperación física y mental. El objetivo recomendado es entre 7 y 9 horas para adultos. La calidad importa tanto como la cantidad: el sueño profundo y REM son las fases más reparadoras.'}
          {metricKey === 'rhr' && 'La frecuencia cardíaca en reposo (RHR) es el número de latidos por minuto cuando estás en reposo. Una RHR más baja suele indicar mejor forma cardiovascular. Aumentos sostenidos pueden señalar estrés, enfermedad o sobre-entrenamiento.'}
        </p>
      </section>
    </main>
  )
}
