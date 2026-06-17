'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ScoreRing from './ScoreRing'
import MetricCard from './MetricCard'
import HeartRateChart from './HeartRateChart'
import SleepStages from './SleepStages'
import ScoreBreakdown from './ScoreBreakdown'
import { useSleepNotification } from './NotificationManager'
import { BaselinePill } from './BaselineDelta'

// Clave de caché en localStorage — cambia si cambian los datos
function insightCacheKey(date, readiness, hrv) {
  return `ai_insight_${date}_r${readiness?.total ?? 'x'}_h${hrv?.avgHRV ?? 'x'}`
}

// Número de semana ISO (para caché del resumen semanal)
function isoWeek() {
  const d = new Date()
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const oneDay = 86400000
  return Math.ceil(((d - jan4) / oneDay + jan4.getDay() + 1) / 7)
}

const MAX_INDEX = 6

// ── Helpers de fecha ──────────────────────────────────────────────────────────

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
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })
}

function dayTitle(i) {
  if (i === 0) return 'HOY'
  if (i === 1) return 'AYER'
  return null
}

function dayLongDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function daySuffix(i, date) {
  if (i === 0) return 'hoy'
  if (i === 1) return 'ayer'
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
  })
}

// ── Colores y etiquetas ───────────────────────────────────────────────────────

function recoveryColor(s) {
  if (s == null) return '#6b7280'
  if (s >= 75) return '#00d4a0'
  if (s >= 50) return '#f5c84b'
  return '#ff5a5a'
}

function strainColor(s) {
  if (s == null) return '#6b7280'
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

// ── Texto del insight dinámico ────────────────────────────────────────────────

function buildInsight(data) {
  const r = data?.readiness
  const sleep = data?.sleep
  const hrv = data?.hrv?.avgHRV
  const score = r?.total

  if (score == null) {
    return {
      title: 'Cargando análisis…',
      body: 'Recopilando tus datos de salud de esta noche.',
    }
  }
  if (score >= 85) {
    return {
      title: 'Recuperación excelente',
      body: `Tu score es ${score}. Tu cuerpo está en plena forma — es buen día para entrenar fuerte.${hrv ? ` HRV: ${hrv} ms.` : ''}`,
    }
  }
  if (score >= 70) {
    return {
      title: 'Buena preparación',
      body: `Score de ${score}. Cuerpo listo para entrenamiento normal.${sleep ? ` Dormiste ${fmtHM(sleep.minutesAsleep)}.` : ''}`,
    }
  }
  if (score >= 55) {
    return {
      title: 'Recuperación moderada',
      body: `Score de ${score}. Considera actividad suave hoy.${sleep ? ` Solo ${fmtHM(sleep.minutesAsleep)} de sueño.` : ''}`,
    }
  }
  return {
    title: 'Prioriza el descanso',
    body: `Score bajo (${score}). Tu cuerpo pide recuperación. Evita entrenamientos intensos hoy.`,
  }
}

// ── Íconos SVG inline ─────────────────────────────────────────────────────────

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
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {M_ICONS[name]}
    </svg>
  )
}

// ── Anillo individual WHOOP ───────────────────────────────────────────────────

function WhoopRing({ label, score, color, displayValue, unit }) {
  return (
    <div className="whoop-ring-item">
      <ScoreRing
        score={score}
        displayValue={displayValue}
        size={86}
        strokeWidth={7}
        color={color}
        fontSize={26}
        fontWeight={800}
        label={label}
        unit={unit}
      />
      <div className="whoop-ring-label">
        {label}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DashboardClient() {
  const [dayIndex, setDayIndex] = useState(0)
  const [cache, setCache] = useState({})
  const [history, setHistory] = useState(null)
  const [loadingDate, setLoadingDate] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [showToast, setShowToast] = useState(false)
  const [notifDismissed, setNotifDismissed] = useState(false)
  const [showNotifBanner, setShowNotifBanner] = useState(false)
  const notifBannerShown = useRef(false)

  // —— Estado del insight de IA ——
  const [aiInsight, setAiInsight] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [weeklyInsight, setWeeklyInsight] = useState(null) // resumen semanal (lunes)
  const lastAiKey = useRef(null)

  const notifySleep = useSleepNotification()

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

  // Guardar readiness para la página de entreno
  useEffect(() => {
    if (dayIndex === 0 && data?.readiness?.total != null) {
      try {
        localStorage.setItem('lastReadiness', String(data.readiness.total))
        const map = JSON.parse(localStorage.getItem('readinessByDate') || '{}')
        map[date] = data.readiness.total
        localStorage.setItem('readinessByDate', JSON.stringify(map))
      } catch { /* ignore */ }
    }
  }, [dayIndex, date, data?.readiness?.total])

  // 🔔 Disparar notificación cuando se registra/carga sueño
  useEffect(() => {
    if (!data?.sleep) return
    // Solo para hoy y ayer (sueño reciente)
    if (dayIndex > 1) return
    const fired = notifySleep(data.sleep, date)
    if (fired && dayIndex === 0 && !notifBannerShown.current) {
      setShowToast(true)
      notifBannerShown.current = true
      setTimeout(() => setShowToast(false), 3200)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.sleep, date, dayIndex])

  // 🧠 Análisis IA — solo cuando hay datos nuevos, con caché localStorage
  useEffect(() => {
    if (!data?.sleep && !data?.readiness) return

    const cacheKey = insightCacheKey(date, data?.readiness, data?.hrv)
    if (cacheKey === lastAiKey.current) return // ya lo tenemos en estado

    // Buscar en caché de localStorage primero (evita llamadas repetidas)
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setAiInsight(JSON.parse(cached))
        lastAiKey.current = cacheKey
        return
      }
    } catch { /* ignore */ }

    // No hay caché → llamar a la API
    setAiLoading(true)
    setAiInsight(null)

    fetch('/api/ai-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        sleep: data.sleep,
        readiness: data.readiness,
        hrv: data.hrv,
        rhr: data.rhr,
      }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.title) {
          const insight = { title: json.title, body: json.body, tip: json.tip }
          setAiInsight(insight)
          lastAiKey.current = cacheKey
          try { localStorage.setItem(cacheKey, JSON.stringify(insight)) } catch { /* ignore */ }
        }
        // Si falla la IA, aiInsight queda null → usa buildInsight() estático
      })
      .catch(() => { /* red fallback silencioso */ })
      .finally(() => setAiLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.sleep, data?.readiness, data?.hrv, date])

  // 📅 Resumen semanal IA (sólo lunes, con caché por número de semana)
  useEffect(() => {
    const today = new Date()
    const isMonday = today.getDay() === 1
    if (!isMonday || dayIndex !== 0) return

    const weekKey = `weekly_insight_${today.getFullYear()}_w${isoWeek()}`
    try {
      const cached = localStorage.getItem(weekKey)
      if (cached) { setWeeklyInsight(JSON.parse(cached)); return }
    } catch { /* ignore */ }

    fetch('/api/health/trends?period=7')
      .then(r => r.json())
      .then(json => {
        if (!json.days?.length) return null
        return fetch('/api/ai-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'weekly', days: json.days, baseline: json.baseline }),
        })
      })
      .then(r => r?.json())
      .then(json => {
        if (json?.title) {
          const insight = { title: json.title, body: json.body, tip: json.tip, weekly: true }
          setWeeklyInsight(insight)
          try { localStorage.setItem(weekKey, JSON.stringify(insight)) } catch { /* ignore */ }
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIndex])

  const indexByDate = useMemo(() => {
    const m = {}
    for (let i = 0; i <= MAX_INDEX; i++) m[dateForIndex(i)] = i
    return m
  }, [])

  const readiness = data?.readiness
  const sleep = data?.sleep
  const hr = data?.heartRate
  const currentBpm = hr?.length ? hr[hr.length - 1].bpm : null

  // Usar insight semanal (lunes) > IA diaria > fallback estático
  const insight = weeklyInsight ?? aiInsight ?? buildInsight(data)
  const isWeekly = !!weeklyInsight

  // Métricas Health Monitor
  const healthMetrics = [
    { label: 'HRV', value: data?.hrv?.avgHRV, unit: 'ms', ok: data?.hrv?.avgHRV != null },
    { label: 'FC Reposo', value: data?.rhr?.bpm, unit: 'bpm', ok: data?.rhr?.bpm != null },
    { label: 'Sueño', value: readiness?.sleepScore, unit: '%', ok: readiness?.sleepScore != null },
  ].filter(m => m.value != null)

  const metricsInRange = healthMetrics.length
  const totalMetrics = Math.max(metricsInRange, 3)

  // Notif banner: comprobar permiso solo en cliente (evita hydration error)
  useEffect(() => {
    if (!notifDismissed && !isLoading && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      setShowNotifBanner(true)
    } else {
      setShowNotifBanner(false)
    }
  }, [notifDismissed, isLoading])

  return (
    <main className="app">
      {/* ══ WHOOP Header ══ */}
      <header className="whoop-header">
        <div className="whoop-header-top">
          {/* Settings */}
          <button className="whoop-icon-btn" aria-label="Ajustes">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Date pill navegable */}
          <div className="whoop-date-pill">
            <button
              className="whoop-date-arrow"
              aria-label="Día anterior"
              disabled={dayIndex >= MAX_INDEX}
              onClick={() => setDayIndex(i => Math.min(MAX_INDEX, i + 1))}
            >
              ‹
            </button>
            <span>{dayTitle(dayIndex) ?? daySuffix(dayIndex, date).toUpperCase()}</span>
            <button
              className="whoop-date-arrow"
              aria-label="Día siguiente"
              disabled={dayIndex <= 0}
              onClick={() => setDayIndex(i => Math.max(0, i - 1))}
            >
              ›
            </button>
          </div>

          {/* Refresh */}
          <button
            className="whoop-icon-btn"
            aria-label="Refrescar datos"
            disabled={refreshing}
            onClick={() => loadDay(date, { fresh: true })}
          >
            <svg
              className={refreshing ? 'spin' : ''}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>

        {/* Marca */}
        <div className="whoop-brand">MIS DATOS</div>

        {/* Los 3 anillos */}
        <div className="whoop-rings-row">
          <WhoopRing
            label="RECOVERY"
            score={readiness?.total ?? null}
            color={recoveryColor(readiness?.total)}
          />
          <WhoopRing
            label="SUEÑO"
            score={readiness?.sleepScore ?? null}
            color="#4a9eff"
          />
          <WhoopRing
            label="ESFUERZO"
            score={data?.dailyStrain ?? null}
            color={strainColor(data?.dailyStrain)}
          />
        </div>
      </header>

      {/* ══ Contenido ══ */}
      <div key={date} className="day-fade" style={{ paddingTop: '16px' }}>

        {error && <div className="error-box">Error cargando datos: {error}</div>}

        {/* Banner para pedir permiso de notificaciones */}
        {showNotifBanner && (
          <div
            className="notif-banner"
            role="button"
            tabIndex={0}
            onClick={() => {
              Notification.requestPermission()
              setNotifDismissed(true)
            }}
          >
            <span className="notif-banner-icon">🔔</span>
            <div className="notif-banner-text">
              <strong>Activa las notificaciones</strong>
              Recibe un resumen de tu sueño cada mañana al abrir la app
            </div>
            <button
              className="notif-banner-close"
              aria-label="Cerrar"
              onClick={e => { e.stopPropagation(); setNotifDismissed(true) }}
            >
              ×
            </button>
          </div>
        )}

        {/* Insight card */}
        {!isLoading && (
          <div className="insight-card">
            <div className="insight-text">
              {aiLoading ? (
                // Shimmer de carga mientras OpenAI responde
                <>
                  <div style={{ height: 16, width: '70%', borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 8, animation: 'pulse 1.4s ease infinite' }} />
                  <div style={{ height: 12, width: '100%', borderRadius: 6, background: 'rgba(255,255,255,0.05)', marginBottom: 6, animation: 'pulse 1.4s ease 0.1s infinite' }} />
                  <div style={{ height: 12, width: '80%', borderRadius: 6, background: 'rgba(255,255,255,0.05)', marginBottom: 6, animation: 'pulse 1.4s ease 0.2s infinite' }} />
                  <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.4s ease 0.3s infinite' }} />
                </>
              ) : (
                <>
                  <p className="insight-title">
                    {isWeekly && <span className="weekly-badge">Semana</span>}
                    {!isWeekly && aiInsight && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 6 }}>IA •</span>}
                    {insight.title}
                  </p>
                  <p className="insight-body">{insight.body}</p>
                  {aiInsight?.tip && (
                    <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>
                      💡 {aiInsight.tip}
                    </p>
                  )}
                  <button className="insight-explore-btn">
                    EXPLORAR DETALLES →
                  </button>
                </>
              )}
            </div>
            <div className="insight-badge">
              <span className="insight-badge-check">✓</span>
              <span className="insight-badge-count">{metricsInRange}</span>
            </div>
          </div>
        )}

        {/* Health Monitor row */}
        {!isLoading && (
          <div className="health-monitor-row">
            <div className="health-monitor-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 20 9 4 6 12 2 12" />
              </svg>
            </div>
            <div className="health-monitor-text">
              <div className="health-monitor-title">Health Monitor</div>
              <div className="health-monitor-sub">Métricas nocturnas</div>
            </div>
            <div className="health-monitor-right">
              <div className="health-monitor-metrics">{metricsInRange}/{totalMetrics} MÉTRICAS</div>
              <div className="health-monitor-status">EN RANGO</div>
            </div>
            <div className="health-monitor-check">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        )}

        {/* Comparativa vs. baseline — flechas debajo del health monitor */}
        {!isLoading && (data?.hrv?.avgHRV != null || data?.rhr?.bpm != null) && readiness?.baseline && (
          <div style={{ display: 'flex', gap: 8, marginTop: -6, marginBottom: 12, flexWrap: 'wrap' }}>
            {data.hrv?.avgHRV != null && readiness.baseline.hrvMean && (
              <BaselinePill
                value={data.hrv.avgHRV}
                baseline={readiness.baseline.hrvMean}
                higherIsBetter={true}
                label={`HRV: ${data.hrv.avgHRV}ms ${data.hrv.avgHRV > readiness.baseline.hrvMean ? '↑' : data.hrv.avgHRV < readiness.baseline.hrvMean ? '↓' : '='} ${Math.abs(Math.round(((data.hrv.avgHRV - readiness.baseline.hrvMean) / readiness.baseline.hrvMean) * 100))}% vs. media`}
              />
            )}
            {data.rhr?.bpm != null && readiness.baseline.rhrMean && (
              <BaselinePill
                value={data.rhr.bpm}
                baseline={readiness.baseline.rhrMean}
                higherIsBetter={false}
                label={`RHR: ${data.rhr.bpm}bpm ${data.rhr.bpm < readiness.baseline.rhrMean ? '↓' : data.rhr.bpm > readiness.baseline.rhrMean ? '↑' : '='} ${Math.abs(Math.round(((data.rhr.bpm - readiness.baseline.rhrMean) / readiness.baseline.rhrMean) * 100))}% vs. media`}
              />
            )}
          </div>
        )}

        {/* ── MY DAY ── */}
        {!isLoading && (
          <div className="my-day-section">
            <div className="section-header">
              <h2 className="section-heading">Mi Día</h2>
            </div>
            <div className="card">
              <div className="activities-inner-label">Actividades de hoy</div>

              {sleep ? (
                <div className="activity-row">
                  <div className="activity-time-pill">
                    <span>🌙</span>
                    {fmtHM(sleep.minutesAsleep)}
                  </div>
                  <span className="activity-name">Sueño</span>
                  <div className="activity-times-col">
                    <span>{fmtTime(sleep.startTime)}</span>
                    <span>{fmtTime(sleep.endTime)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
                  Sin datos de sueño para este día
                </div>
              )}

              <button className="start-activity-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Iniciar actividad
              </button>
            </div>
          </div>
        )}

        {/* ── Grid de métricas de sueño ── */}
        {!isLoading && (
          <>
            <div className="section-header" style={{ marginBottom: 12 }}>
              <h2 className="section-heading">Mi Dashboard</h2>
            </div>

            <section className="metric-grid">
              <MetricCard
                icon={<MetricIcon name="moon" />}
                label="Sueño total"
                value={fmtHM(sleep?.minutesAsleep)}
                sub={sleep ? `${fmtTime(sleep.startTime)} – ${fmtTime(sleep.endTime)}` : '--'}
              />
              <MetricCard
                icon={<MetricIcon name="waves" />}
                label="Sueño profundo"
                value={sleep ? fmtHM(sleep.deep) : '--'}
                sub={sleep?.minutesAsleep ? `${Math.round((sleep.deep / sleep.minutesAsleep) * 100)}% del total` : '--'}
              />
              <MetricCard
                icon={<MetricIcon name="eye" />}
                label="REM"
                value={sleep ? fmtHM(sleep.rem) : '--'}
                sub={sleep?.minutesAsleep ? `${Math.round((sleep.rem / sleep.minutesAsleep) * 100)}% del total` : '--'}
              />
              <MetricCard
                icon={<MetricIcon name="bell" />}
                label="Interrupciones"
                value={sleep ? `${sleep.minutesAwake}m` : '--'}
                sub="despierto de noche"
              />
            </section>
          </>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="score-loading" style={{ minHeight: 300 }}>
            <div className="spinner" />
          </div>
        )}

        {/* FC */}
        {hr?.length > 0 && (
          <section className="card">
            <div className="hr-head">
              <span className="hr-title">FC · {daySuffix(dayIndex, date)}</span>
              {currentBpm != null && (
                <span className="hr-current">{currentBpm} bpm</span>
              )}
            </div>
            <HeartRateChart data={hr} />
          </section>
        )}

        {/* Fases de sueño */}
        {sleep && (
          <section className="card">
            <div className="card-title">Fases de sueño</div>
            <SleepStages sleep={sleep} />
          </section>
        )}

        {/* Score breakdown */}
        {readiness && (
          <section className="card">
            <div className="card-title">Desglose del score</div>
            <ScoreBreakdown breakdown={readiness.breakdown} />
          </section>
        )}

        {/* Baseline note */}
        {!isLoading && (readiness?.baseline?.hrvMean != null || readiness?.baseline?.rhrMean != null) && (
          <div className="baseline-note">
            {readiness.baseline.hrvMean != null && <>Tu HRV media: {readiness.baseline.hrvMean} ms</>}
            {readiness.baseline.hrvMean != null && readiness.baseline.rhrMean != null && ' · '}
            {readiness.baseline.rhrMean != null && <>FC reposo media: {readiness.baseline.rhrMean} bpm</>}
          </div>
        )}

      </div>

      {/* Toast de confirmación de notificación */}
      {showToast && (
        <div className="sleep-sent-toast">
          🌙 Resumen de sueño enviado
        </div>
      )}
    </main>
  )
}
