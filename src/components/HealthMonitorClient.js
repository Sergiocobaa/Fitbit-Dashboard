'use client'

import { useEffect, useState } from 'react'
import { BaselinePill } from './BaselineDelta'

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
}

function MetricBox({ icon, label, value, unit, pill, loading }) {
  return (
    <div className="hm-metric-card">
      <div className="hm-metric-top">
        <span className="hm-metric-label">{icon} {label}</span>
      </div>
      {loading ? (
        <div className="hm-shimmer" />
      ) : (
        <>
          <div className="hm-metric-value">
            <span className="hm-metric-number">{value ?? '--'}</span>
            {unit && <span className="hm-metric-unit"> {unit}</span>}
          </div>
          {pill && <div style={{ marginTop: 8 }}>{pill}</div>}
        </>
      )}
    </div>
  )
}

export default function HealthMonitorClient() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const date = todayStr()
    fetch(`/api/health?date=${date}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const sleep = data?.sleep
  const hrv = data?.hrv
  const rhr = data?.rhr
  const baseline = data?.readiness?.baseline

  // Estimar respiratory rate y SpO2 (Fitbit no siempre expone estos via Health API)
  // Mostramos "--" si no están disponibles, con nota
  const metrics = [
    {
      icon: '🫁',
      label: 'FRECUENCIA RESPIRATORIA',
      value: null, // Fitbit no expone este dato via Google Health API v4
      unit: 'resp/min',
      pill: null,
      note: 'No disponible via API',
    },
    {
      icon: '🩸',
      label: 'OXÍGENO EN SANGRE (SPO2)',
      value: null, // Similar — requiere otro endpoint
      unit: '%',
      pill: null,
      note: 'No disponible via API',
    },
    {
      icon: '❤️',
      label: 'FC NOCTURNA',
      value: rhr?.bpm,
      unit: 'bpm',
      pill: baseline?.rhrMean
        ? <BaselinePill value={rhr?.bpm} baseline={baseline.rhrMean} higherIsBetter={false} />
        : null,
    },
    {
      icon: '📈',
      label: 'HRV (VARIABILIDAD)',
      value: hrv?.avgHRV,
      unit: 'ms',
      pill: baseline?.hrvMean
        ? <BaselinePill value={hrv?.avgHRV} baseline={baseline.hrvMean} higherIsBetter={true} />
        : null,
    },
  ]

  // Sueño profundo y REM como métricas extra
  const sleepMetrics = [
    {
      icon: '🌙',
      label: 'SUEÑO TOTAL',
      value: sleep?.minutesAsleep
        ? `${Math.floor(sleep.minutesAsleep / 60)}h ${sleep.minutesAsleep % 60}m`
        : null,
      unit: '',
      pill: baseline?.sleepMeanMin
        ? <BaselinePill value={sleep?.minutesAsleep} baseline={baseline.sleepMeanMin} higherIsBetter={true} label={`Tu media: ${Math.floor(baseline.sleepMeanMin / 60)}h ${Math.round(baseline.sleepMeanMin % 60)}m`} />
        : null,
    },
    {
      icon: '🌊',
      label: 'SUEÑO PROFUNDO',
      value: sleep?.deep
        ? `${Math.floor(sleep.deep / 60)}h ${sleep.deep % 60}m`
        : null,
      unit: '',
      pill: sleep?.minutesAsleep && sleep?.deep
        ? <BaselinePill
            value={Math.round((sleep.deep / sleep.minutesAsleep) * 100)}
            baseline={20}
            higherIsBetter={true}
            label={`${Math.round((sleep.deep / sleep.minutesAsleep) * 100)}% del total`}
          />
        : null,
    },
    {
      icon: '👁️',
      label: 'SUEÑO REM',
      value: sleep?.rem
        ? `${Math.floor(sleep.rem / 60)}h ${sleep.rem % 60}m`
        : null,
      unit: '',
      pill: sleep?.minutesAsleep && sleep?.rem
        ? <BaselinePill
            value={Math.round((sleep.rem / sleep.minutesAsleep) * 100)}
            baseline={22}
            higherIsBetter={true}
            label={`${Math.round((sleep.rem / sleep.minutesAsleep) * 100)}% del total`}
          />
        : null,
    },
    {
      icon: '⏰',
      label: 'TIEMPO DESPIERTO',
      value: sleep?.minutesAwake != null ? `${sleep.minutesAwake}m` : null,
      unit: '',
      pill: sleep?.minutesAwake != null
        ? <BaselinePill
            value={sleep.minutesAwake}
            baseline={15}
            higherIsBetter={false}
            label={sleep.minutesAwake <= 15 ? 'Normal' : sleep.minutesAwake <= 30 ? 'Algo elevado' : 'Elevado'}
          />
        : null,
    },
  ]

  if (error) {
    return (
      <main className="app">
        <div className="hm-header">
          <h1 className="hm-title">HEALTH MONITOR</h1>
        </div>
        <div className="error-box">Error cargando datos: {error}</div>
      </main>
    )
  }

  return (
    <main className="app">
      {/* Header */}
      <div className="hm-header">
        <h1 className="hm-title">HEALTH MONITOR</h1>
        <p className="hm-subtitle">Métricas capturadas durante tu sueño de anoche</p>
      </div>

      {/* Grid principal 2×2 — métricas cardíacas */}
      <section style={{ marginBottom: 16 }}>
        <div className="hm-section-label">CARDÍACO & HRV</div>
        <div className="hm-grid">
          {metrics.map((m, i) => (
            <MetricBox
              key={i}
              icon={m.icon}
              label={m.label}
              value={m.note ? m.note : m.value}
              unit={m.note ? '' : m.unit}
              pill={m.pill}
              loading={loading && !m.note}
            />
          ))}
        </div>
      </section>

      {/* Grid sueño 2×2 */}
      <section style={{ marginBottom: 16 }}>
        <div className="hm-section-label">SUEÑO DE ANOCHE</div>
        <div className="hm-grid">
          {sleepMetrics.map((m, i) => (
            <MetricBox
              key={i}
              icon={m.icon}
              label={m.label}
              value={m.value}
              unit={m.unit}
              pill={m.pill}
              loading={loading}
            />
          ))}
        </div>
      </section>

      {/* About section */}
      <section className="card" style={{ marginTop: 8 }}>
        <div className="hm-section-label" style={{ marginBottom: 10 }}>SOBRE HEALTH MONITOR</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Health Monitor muestra las lecturas capturadas durante tu ventana de sueño nocturno. 
          Úsalo para comprobar cómo se recuperó tu cuerpo antes de compararlo con tus lecturas diurnas. 
          La FC en reposo, la variabilidad cardíaca y la calidad del sueño son más útiles cuando se 
          comparan con tu propio baseline personal de los últimos 30 días.
        </p>
        {baseline && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {baseline.hrvMean && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                HRV media 30d: <strong style={{ color: 'var(--text)' }}>{baseline.hrvMean} ms</strong>
              </div>
            )}
            {baseline.rhrMean && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                FC reposo media: <strong style={{ color: 'var(--text)' }}>{baseline.rhrMean} bpm</strong>
              </div>
            )}
            {baseline.sleepMeanMin && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Sueño medio: <strong style={{ color: 'var(--text)' }}>{Math.floor(baseline.sleepMeanMin / 60)}h {Math.round(baseline.sleepMeanMin % 60)}m</strong>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
