'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ScoreRing, { scoreColor } from './ScoreRing'
import MetricCard from './MetricCard'
import HeartRateChart from './HeartRateChart'
import SleepStages from './SleepStages'
import ScoreBreakdown from './ScoreBreakdown'

const MAX_INDEX = 6 // 0 = hoy, 6 = hace 6 días

function dateForIndex(i) {
  const d = new Date()
  d.setDate(d.getDate() - i)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtHM(minutes) {
  if (!minutes) return '--'
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function fmtTime(iso) {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
}

function dayTitle(i, date) {
  if (i === 0) return 'Hoy'
  if (i === 1) return 'Ayer'
  const s = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function daySuffix(i, date) {
  if (i === 0) return 'hoy'
  if (i === 1) return 'ayer'
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
}

function scoreLabel(score) {
  if (score == null) return 'Sin datos'
  if (score >= 85) return 'Excelente — entrena fuerte hoy'
  if (score >= 70) return 'Bueno — entrenamiento normal'
  if (score >= 55) return 'Moderado — actividad suave recomendada'
  return 'Bajo — prioriza el descanso hoy'
}

function recoveryColor(s) {
  if (s == null) return '#6b6a7a'
  if (s >= 75) return '#00d4a0'
  if (s >= 50) return '#f5c84b'
  return '#ff5a5a'
}

function recoveryLabel(s) {
  if (s == null) return 'Sin datos'
  if (s >= 75) return 'Reparador'
  if (s >= 50) return 'Moderado'
  return 'Pobre'
}

function strainColor(s) {
  if (s == null) return '#6b6a7a'
  if (s < 40) return '#4a9eff'
  if (s <= 70) return '#00d4a0'
  return '#f5924b'
}

function strainLabel(s) {
  if (s == null) return 'Sin datos'
  if (s < 40) return 'Bajo'
  if (s <= 70) return 'Óptimo'
  return 'Alto'
}

function MiniRing({ title, score, color, label }) {
  return (
    <div className="mini-ring">
      <div className="mini-ring-title">{title}</div>
      <ScoreRing score={score} size={80} color={color} label={title} />
      <div className="mini-ring-label">{label}</div>
    </div>
  )
}

function updatedLabel(fetchedAt, now) {
  if (!fetchedAt) return ''
  const mins = Math.max(0, Math.floor((now - fetchedAt) / 60000))
  if (mins === 0) return 'Actualizado ahora'
  if (mins < 60) return `Actualizado hace ${mins} min`
  return `Actualizado hace ${Math.floor(mins / 60)} h`
}

function Pill({ label, value, color }) {
  return (
    <div className="pill">
      <span className="pill-label">{label}</span>
      <span className="pill-value" style={{ color }}>{value}</span>
    </div>
  )
}

export default function DashboardClient() {
  const [dayIndex, setDayIndex] = useState(0)
  const [cache, setCache] = useState({}) // date -> { data, fetchedAt }
  const [history, setHistory] = useState(null)
  const [loadingDate, setLoadingDate] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(Date.now())

  const date = dateForIndex(dayIndex)
  const entry = cache[date]
  const data = entry?.data
  const isLoading = !data && loadingDate === date

  const loadDay = useCallback(async (d, { fresh = false } = {}) => {
    if (fresh) setRefreshing(true)
    else setLoadingDate(d)
    setError(null)
    try {
      const res = await fetch(`/api/health?date=${d}${fresh ? '&fresh=1' : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      setCache(prev => ({ ...prev, [d]: { data: json, fetchedAt: Date.now() } }))
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
      setLoadingDate(prev => (prev === d ? null : prev))
    }
  }, [])

  // al montar: día de hoy + histórico de scores para el selector, en paralelo
  useEffect(() => {
    loadDay(dateForIndex(0))
    fetch('/api/health/history')
      .then(r => r.json())
      .then(j => { if (j.days) setHistory(j.days) })
      .catch(() => {})
  }, [loadDay])

  useEffect(() => {
    if (!cache[date] && loadingDate !== date) loadDay(date)
  }, [date, cache, loadingDate, loadDay])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // índice de navegación por fecha, para pintar/clicar el selector de tendencia
  const indexByDate = useMemo(() => {
    const m = {}
    for (let i = 0; i <= MAX_INDEX; i++) m[dateForIndex(i)] = i
    return m
  }, [])

  const readiness = data?.readiness
  const sleep = data?.sleep

  return (
    <main className="app">
      <header className="header">
        <div className="header-row">
          <button
            className="nav-btn"
            aria-label="Día anterior"
            disabled={dayIndex >= MAX_INDEX}
            onClick={() => setDayIndex(i => Math.min(MAX_INDEX, i + 1))}
          >
            ‹
          </button>
          <div className="header-date">
            <h1>{dayTitle(dayIndex, date)}</h1>
            <div className="header-sub">
              {new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <button
            className="nav-btn"
            aria-label="Día siguiente"
            disabled={dayIndex <= 0}
            onClick={() => setDayIndex(i => Math.max(0, i - 1))}
          >
            ›
          </button>
        </div>

        <div className="header-meta">
          <span>{updatedLabel(entry?.fetchedAt, now)}</span>
          <button
            className="refresh-btn"
            aria-label="Refrescar datos"
            disabled={refreshing}
            onClick={() => loadDay(date, { fresh: true })}
          >
            <svg className={refreshing ? 'spin' : ''} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>

        {history && (
          <div className="trend-strip">
            {history.map(h => {
              const idx = indexByDate[h.date]
              const initial = new Date(`${h.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'narrow' })
              return (
                <button
                  key={h.date}
                  className={`trend-day${idx === dayIndex ? ' active' : ''}`}
                  onClick={() => idx != null && setDayIndex(idx)}
                  aria-label={`Ver ${h.date}`}
                >
                  <span>{initial}</span>
                  <span className="trend-dot" style={{ background: h.readiness != null ? scoreColor(h.readiness) : '#1e1e2a' }} />
                </button>
              )
            })}
          </div>
        )}
      </header>

      {error && <div className="error-box">Error cargando datos: {error}</div>}

      <div key={date} className="day-fade">
        <section className="card score-card">
          {isLoading ? (
            <div className="score-loading"><div className="spinner" /></div>
          ) : (
            <>
              <ScoreRing score={readiness?.total} />
              <div className="score-label">{scoreLabel(readiness?.total)}</div>
              <div className="pill-row">
                <Pill label="Sleep" value={readiness?.sleepScore ?? '--'} color="#00d4a0" />
                <Pill label="HRV" value={data?.hrv ? `${data.hrv.avgHRV} ms` : '--'} color="#7c5cbf" />
                <Pill label="RHR" value={data?.rhr ? `${data.rhr.bpm} bpm` : '--'} color="#4a9eff" />
              </div>
            </>
          )}
        </section>

        {!isLoading && (data?.sleepRecovery != null || data?.dailyStrain != null) && (
          <section className="card dual-ring-card">
            <MiniRing
              title="Recuperación"
              score={data?.sleepRecovery ?? null}
              color={recoveryColor(data?.sleepRecovery)}
              label={recoveryLabel(data?.sleepRecovery)}
            />
            <MiniRing
              title="Esfuerzo"
              score={data?.dailyStrain ?? null}
              color={strainColor(data?.dailyStrain)}
              label={strainLabel(data?.dailyStrain)}
            />
          </section>
        )}

        <section className="metric-grid">
          <MetricCard icon="😴" label="Sueño total" value={fmtHM(sleep?.minutesAsleep)} sub={sleep ? `${fmtTime(sleep.startTime)} – ${fmtTime(sleep.endTime)}` : '--'} color="#00d4a0" />
          <MetricCard icon="🌊" label="Sueño profundo" value={sleep ? fmtHM(sleep.deep) : '--'} sub={sleep?.minutesAsleep ? `${Math.round((sleep.deep / sleep.minutesAsleep) * 100)}% del total` : '--'} color="#7c5cbf" />
          <MetricCard icon="🌙" label="REM" value={sleep ? fmtHM(sleep.rem) : '--'} sub={sleep?.minutesAsleep ? `${Math.round((sleep.rem / sleep.minutesAsleep) * 100)}% del total` : '--'} color="#4a9eff" />
          <MetricCard icon="⏰" label="Interrupciones" value={sleep ? `${sleep.minutesAwake}m` : '--'} sub="despierto durante la noche" color="#e6a23c" />
        </section>

        {data?.heartRate?.length > 0 && (
          <section className="card">
            <div className="card-title">Estrés cardiovascular · {daySuffix(dayIndex, date)}</div>
            <HeartRateChart data={data.heartRate} />
          </section>
        )}

        {sleep && (
          <section className="card">
            <div className="card-title">Fases de sueño</div>
            <SleepStages sleep={sleep} />
          </section>
        )}

        {readiness && (
          <section className="card">
            <div className="card-title">Desglose del score</div>
            <ScoreBreakdown breakdown={readiness.breakdown} />
          </section>
        )}
      </div>
    </main>
  )
}
