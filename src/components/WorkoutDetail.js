'use client'

import Link from 'next/link'
import WorkoutHRChart from './WorkoutHRChart'

const TYPE_NAMES = {
  STRENGTH_TRAINING: 'Fuerza',
  RUNNING: 'Carrera',
  CYCLING: 'Ciclismo',
  SWIMMING: 'Natación',
  INTERVAL_WORKOUT: 'Intervalos',
  HIIT: 'HIIT',
  WALKING: 'Caminata',
  YOGA: 'Yoga',
}

const ZONE_META = [
  { key: 'z1', color: '#6b6a7a', label: 'Calentamiento' },
  { key: 'z2', color: '#4a9eff', label: 'Aeróbico base' },
  { key: 'z3', color: '#00d4a0', label: 'Aeróbico' },
  { key: 'z4', color: '#f5c84b', label: 'Umbral' },
  { key: 'z5', color: '#ff5a5a', label: 'Máximo' },
]

const EVENT_LABELS = { START: 'Inicio', PAUSE: 'Pausa', RESUME: 'Reanudación', END: 'Fin' }

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' })
}

function fmtLongDate(iso) {
  const d = new Date(iso)
  const wd = d.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'Europe/Madrid' })
  const rest = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${rest}`
}

// color de FC según zona (FCmax 194)
function hrColor(bpm, hrMax) {
  if (bpm == null) return '#f0eff4'
  const pct = bpm / hrMax
  if (pct >= 0.8) return '#ff5a5a'
  if (pct >= 0.7) return '#f5c84b'
  if (pct >= 0.6) return '#00d4a0'
  if (pct >= 0.5) return '#4a9eff'
  return '#6b6a7a'
}

export default function WorkoutDetail({ detail }) {
  if (!detail) {
    return (
      <main className="app detail-page">
        <header className="detail-header">
          <Link href="/workout" className="back-btn" aria-label="Volver">‹</Link>
          <h1 className="detail-title">Entreno</h1>
        </header>
        <div className="exercise-empty">
          <p>No se encontró el entreno</p>
        </div>
      </main>
    )
  }

  const { exercise, heartRate, zones, stats, restingHR, hrMax } = detail

  // línea de tiempo de eventos: START + pausas/reanudaciones + END
  const pauses = (exercise.events || []).filter(e => e.type === 'PAUSE' || e.type === 'RESUME')
  const timeline = [
    { type: 'START', time: exercise.startTime },
    ...pauses,
    { type: 'END', time: exercise.endTime },
  ].sort((a, b) => new Date(a.time) - new Date(b.time))

  const maxZoneMin = Math.max(...ZONE_META.map(z => zones[z.key] || 0), 1)

  return (
    <main className="app detail-page">
      <header className="detail-header">
        <Link href="/workout" className="back-btn" aria-label="Volver">‹</Link>
        <h1 className="detail-title">{exercise.name}</h1>
      </header>

      <div className="detail-daydate">{fmtLongDate(exercise.startTime)} · {TYPE_NAMES[exercise.type] || 'Entreno'}</div>

      <section className="dx-grid">
        <div className="card dx-tile">
          <div className="dx-label">Duración</div>
          <div className="dx-value" style={{ color: '#00d4a0' }}>{exercise.durationMinutes} min</div>
        </div>
        <div className="card dx-tile">
          <div className="dx-label">FC media</div>
          <div className="dx-value" style={{ color: hrColor(stats.avgHR, hrMax) }}>
            {stats.avgHR != null ? `${stats.avgHR}` : '--'}
            {stats.avgHR != null && <span className="dx-unit"> bpm</span>}
          </div>
        </div>
        <div className="card dx-tile">
          <div className="dx-label">FC máxima</div>
          <div className="dx-value" style={{ color: '#ff5a5a' }}>
            {stats.maxHR != null ? `${stats.maxHR}` : '--'}
            {stats.maxHR != null && <span className="dx-unit"> bpm</span>}
          </div>
        </div>
        <div className="card dx-tile">
          <div className="dx-label">Calorías</div>
          <div className="dx-value">--</div>
        </div>
      </section>

      {heartRate.length > 0 && (
        <section className="card">
          <div className="card-title">FC durante el entreno</div>
          <WorkoutHRChart data={heartRate} hrMax={hrMax} restingHR={restingHR} />
        </section>
      )}

      <section className="card">
        <div className="card-title">Zonas de frecuencia cardíaca</div>
        <div className="zones">
          {ZONE_META.map(z => {
            const min = zones[z.key] || 0
            return (
              <div key={z.key} className="zone-row">
                <span className="zone-label">{z.label}</span>
                <div className="zone-track">
                  <div className="zone-fill" style={{ width: `${(min / maxZoneMin) * 100}%`, background: z.color }} />
                </div>
                <span className="zone-min">{min}m</span>
              </div>
            )
          })}
        </div>
      </section>

      {pauses.length > 0 && (
        <section className="card">
          <div className="card-title">Eventos</div>
          <div className="event-timeline">
            {timeline.map((ev, i) => {
              const next = timeline[i + 1]
              const segMin = next ? Math.round((new Date(next.time) - new Date(ev.time)) / 60000) : null
              return (
                <div key={i} className="event-row">
                  <span className="event-dot" />
                  <span className="event-type">{EVENT_LABELS[ev.type] || ev.type}</span>
                  <span className="event-time">{fmtTime(ev.time)}</span>
                  {segMin != null && <span className="event-seg">+{segMin}m</span>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-title">Contexto del día</div>
        <div className="detail-row">
          <span className="detail-key">Readiness ese día</span>
          <span className="detail-val">--</span>
        </div>
        <div className="detail-row">
          <span className="detail-key">Sueño previo</span>
          <span className="detail-val">--</span>
        </div>
      </section>
    </main>
  )
}
