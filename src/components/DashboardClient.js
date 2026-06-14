'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ScoreRing from './ScoreRing'
import MetricCard from './MetricCard'
import HeartRateChart from './HeartRateChart'
import SleepStages from './SleepStages'
import ScoreBreakdown from './ScoreBreakdown'

const MAX_INDEX = 6 // 0 = hoy, 6 = hace 6 días

// iconos de métricas (outline, 16px, strokeWidth 1.5)
const M_ICONS = {
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  waves: <path d="M2 12h2c1 0 1-2 2-2s1 2 2 2 1-2 2-2 1 2 2 2 1-2 2-2 1 2 2 2h2" />,
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
}

function MetricIcon({ name }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {M_ICONS[name]}
    </svg>
  )
}

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

function dayTitle(i) {
  if (i === 0) return 'Hoy'
  if (i === 1) return 'Ayer'
  return null
}

function dayLongDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
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
      <ScoreRing score={score} size={72} strokeWidth={6} color={color} fontSize={22} fontWeight={700} label={title} />
      <div className="mini-ring-label">{label}</div>
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

  // guarda el readiness de hoy para que la página de entreno lo etiquete
  useEffect(() => {
    if (dayIndex === 0 && data?.readiness?.total != null) {
      try {
        localStorage.setItem('lastReadiness', String(data.readiness.total))
        const map = JSON.parse(localStorage.getItem('readinessByDate') || '{}')
        map[date] = data.readiness.total
        localStorage.setItem('readinessByDate', JSON.stringify(map))
      } catch {
        /* ignore */
      }
    }
  }, [dayIndex, date, data?.readiness?.total])

  // índice de navegación por fecha, para pintar/clicar el selector de tendencia
  const indexByDate = useMemo(() => {
    const m = {}
    for (let i = 0; i <= MAX_INDEX; i++) m[dateForIndex(i)] = i
    return m
  }, [])

  const readiness = data?.readiness
  const sleep = data?.sleep
  const hr = data?.heartRate
  const currentBpm = hr?.length ? hr[hr.length - 1].bpm : null

  return (
    <main className="app">
      <header className="header">
        <div className="header-row">
          <div>
            <div className="header-sub">{dayLongDate(date)}</div>
            <div className="header-title-row">
              <svg className="header-logo" width={32} height={32} viewBox="0 0 200 200" fill="none" aria-hidden>
                <path d="M 39.38 135 A 70 70 0 1 1 160.62 135" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" fill="none" />
                <polyline points="45,100 65,100 75,75 85,125 95,88 105,100 155,100" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <h1>{dayTitle(dayIndex) ?? daySuffix(dayIndex, date)}</h1>
            </div>
          </div>
          <button
            className="refresh-btn"
            aria-label="Refrescar datos"
            disabled={refreshing}
            onClick={() => loadDay(date, { fresh: true })}
          >
            <svg className={refreshing ? 'spin' : ''} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>

        <div className="day-selector">
          <button
            className="day-arrow"
            aria-label="Día anterior"
            disabled={dayIndex >= MAX_INDEX}
            onClick={() => setDayIndex(i => Math.min(MAX_INDEX, i + 1))}
          >
            ‹
          </button>
          <div className="day-dots">
            {(history ?? Array.from({ length: MAX_INDEX + 1 }, () => null)).map((h, i) => {
              const d = h?.date ?? dateForIndex(MAX_INDEX - i)
              const idx = indexByDate[d]
              const hasData = h?.readiness != null
              const active = idx === dayIndex
              return (
                <button
                  key={d}
                  className={`day-dot${active ? ' active' : ''}${hasData ? ' has-data' : ''}`}
                  onClick={() => idx != null && setDayIndex(idx)}
                  aria-label={`Ver ${d}`}
                />
              )
            })}
          </div>
          <button
            className="day-arrow"
            aria-label="Día siguiente"
            disabled={dayIndex <= 0}
            onClick={() => setDayIndex(i => Math.max(0, i - 1))}
          >
            ›
          </button>
        </div>
      </header>

      {error && <div className="error-box">Error cargando datos: {error}</div>}

      <div key={date} className="day-fade">
        <section className="card readiness-card">
          {isLoading ? (
            <div className="score-loading"><div className="spinner" /></div>
          ) : (
            <>
              <ScoreRing score={readiness?.total} size={110} strokeWidth={8} fontSize={48} fontWeight={800} />
              <div className="readiness-label">{scoreLabel(readiness?.total)}</div>
              <div className="readiness-metrics">
                <div className="rm-item">
                  <span className="rm-value">{readiness?.sleepScore ?? '--'}</span>
                  <span className="rm-label">Sleep</span>
                </div>
                <div className="rm-sep" />
                <div className="rm-item">
                  <span className="rm-value">{data?.hrv ? data.hrv.avgHRV : '--'}</span>
                  <span className="rm-label">HRV</span>
                </div>
                <div className="rm-sep" />
                <div className="rm-item">
                  <span className="rm-value">{data?.rhr ? data.rhr.bpm : '--'}</span>
                  <span className="rm-label">RHR</span>
                </div>
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
            <div className="dual-divider" />
            <MiniRing
              title="Esfuerzo"
              score={data?.dailyStrain ?? null}
              color={strainColor(data?.dailyStrain)}
              label={strainLabel(data?.dailyStrain)}
            />
          </section>
        )}

        {!isLoading && (readiness?.baseline?.hrvMean != null || readiness?.baseline?.rhrMean != null) && (
          <div className="baseline-note">
            {readiness.baseline.hrvMean != null && <>Tu HRV media: {readiness.baseline.hrvMean} ms</>}
            {readiness.baseline.hrvMean != null && readiness.baseline.rhrMean != null && ' · '}
            {readiness.baseline.rhrMean != null && <>FC reposo media: {readiness.baseline.rhrMean} bpm</>}
          </div>
        )}

        <section className="metric-grid">
          <MetricCard icon={<MetricIcon name="moon" />} label="Sueño total" value={fmtHM(sleep?.minutesAsleep)} sub={sleep ? `${fmtTime(sleep.startTime)} – ${fmtTime(sleep.endTime)}` : '--'} />
          <MetricCard icon={<MetricIcon name="waves" />} label="Sueño profundo" value={sleep ? fmtHM(sleep.deep) : '--'} sub={sleep?.minutesAsleep ? `${Math.round((sleep.deep / sleep.minutesAsleep) * 100)}% del total` : '--'} />
          <MetricCard icon={<MetricIcon name="eye" />} label="REM" value={sleep ? fmtHM(sleep.rem) : '--'} sub={sleep?.minutesAsleep ? `${Math.round((sleep.rem / sleep.minutesAsleep) * 100)}% del total` : '--'} />
          <MetricCard icon={<MetricIcon name="bell" />} label="Interrupciones" value={sleep ? `${sleep.minutesAwake}m` : '--'} sub="despierto de noche" />
        </section>

        {hr?.length > 0 && (
          <section className="card">
            <div className="hr-head">
              <span className="hr-title">FC · {daySuffix(dayIndex, date)}</span>
              {currentBpm != null && <span className="hr-current">{currentBpm} bpm</span>}
            </div>
            <HeartRateChart data={hr} />
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
