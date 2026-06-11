'use client'

import { useEffect, useMemo, useState } from 'react'

const TYPES = ['Fuerza', 'Cardio', 'Ciclismo', 'Natación', 'HIIT', 'Otro']
const INTENSITIES = ['Baja', 'Media', 'Alta', 'Máxima']

// exerciseType de Fitbit → nombre legible (fallback si no viene displayName)
const FITBIT_NAMES = {
  STRENGTH_TRAINING: 'Fuerza',
  RUNNING: 'Carrera',
  CYCLING: 'Ciclismo',
  SWIMMING: 'Natación',
  INTERVAL_WORKOUT: 'HIIT',
  HIIT: 'HIIT',
  WALKING: 'Caminata',
  YOGA: 'Yoga',
}

const STORAGE_KEY = 'workouts'
const READINESS_KEY = 'readinessByDate'

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtShortDate(dateStr) {
  const s = new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  return s.replace(/\b\w/g, c => c.toUpperCase()).replace(/\./g, '')
}

function fmtLongDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  const wd = cap(d.toLocaleDateString('es-ES', { weekday: 'long' }))
  const mo = d.toLocaleDateString('es-ES', { month: 'long' })
  return `${wd} ${d.getDate()} de ${mo}`
}

function fmtTime24(iso) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' })
}

// solo entrenos del mes actual y el anterior
function inRecentMonths(dateStr) {
  const now = new Date()
  const d = new Date(`${dateStr}T12:00:00`)
  const cur = now.getFullYear() * 12 + now.getMonth()
  const m = d.getFullYear() * 12 + d.getMonth()
  return m <= cur && cur - m <= 1
}

export default function WorkoutClient() {
  const [manual, setManual] = useState([])
  const [fitbit, setFitbit] = useState([])
  const [readinessByDate, setReadinessByDate] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [type, setType] = useState('Fuerza')
  const [duration, setDuration] = useState(60)
  const [intensity, setIntensity] = useState('Media')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(stored)) setManual(stored)
      const rbd = JSON.parse(localStorage.getItem(READINESS_KEY) || '{}')
      if (rbd && typeof rbd === 'object') setReadinessByDate(rbd)
    } catch {
      /* localStorage corrupto o no disponible */
    }

    let cancelled = false
    fetch('/api/exercises')
      .then(r => r.json())
      .then(j => {
        if (!cancelled && Array.isArray(j.exercises)) setFitbit(j.exercises)
      })
      .catch(() => {
        /* si la API falla mostramos solo los manuales, sin error visible */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  function persistManual(next) {
    setManual(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  function save() {
    const dur = Math.max(5, Math.min(300, Number(duration) || 0))
    const date = todayStr()
    const readiness = Number(localStorage.getItem('lastReadiness')) || null
    const entry = {
      id: String(Date.now()),
      type,
      duration: dur,
      intensity,
      notes: notes.trim(),
      date,
      readiness,
      source: 'manual',
    }
    persistManual([entry, ...manual])
    setNotes('')

    if (readiness != null) {
      const next = { ...readinessByDate, [date]: readiness }
      setReadinessByDate(next)
      try {
        localStorage.setItem(READINESS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
    }
  }

  function remove(id) {
    persistManual(manual.filter(w => w.id !== id))
  }

  // normaliza manuales + Fitbit (filtrados a mes actual/anterior) y ordena por fecha desc
  const items = useMemo(() => {
    const fromManual = manual.map(w => ({
      key: `manual-${w.id}`,
      id: w.id,
      source: 'manual',
      title: w.type,
      type: w.type,
      date: w.date,
      durationMinutes: w.duration,
      intensity: w.intensity,
      notes: w.notes,
      sortTs: Number(w.id) || 0,
    }))
    const fromFitbit = fitbit
      .filter(e => inRecentMonths(e.date))
      .map(e => ({
        key: `fitbit-${e.id}`,
        id: e.id,
        source: 'fitbit',
        title: e.name || FITBIT_NAMES[e.type] || 'Entreno',
        type: e.type,
        date: e.date,
        durationMinutes: e.durationMinutes,
        startTime: e.startTime,
        endTime: e.endTime,
        events: e.events || [],
        sortTs: new Date(e.startTime).getTime() || 0,
      }))
    return [...fromManual, ...fromFitbit].sort((a, b) =>
      a.date === b.date ? b.sortTs - a.sortTs : a.date < b.date ? 1 : -1
    )
  }, [manual, fitbit])

  return (
    <main className="app workout-page">
      <header className="workout-header">
        <h1>Entreno</h1>
      </header>

      <section className="card">
        <div className="card-title">Registrar entreno</div>

        <label className="field-label">Tipo</label>
        <div className="pill-grid">
          {TYPES.map(t => (
            <button
              key={t}
              className={`select-pill${type === t ? ' active' : ''}`}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="field-label">Duración</label>
        <div className="duration-field">
          <input
            className="duration-input"
            type="number"
            min={5}
            max={300}
            value={duration}
            onChange={e => setDuration(e.target.value)}
          />
          <span className="duration-unit">min</span>
        </div>

        <label className="field-label">Intensidad</label>
        <div className="pill-row-select">
          {INTENSITIES.map(i => (
            <button
              key={i}
              className={`select-pill${intensity === i ? ' active' : ''}`}
              onClick={() => setIntensity(i)}
            >
              {i}
            </button>
          ))}
        </div>

        <label className="field-label">Notas</label>
        <textarea
          className="notes-input"
          maxLength={100}
          rows={2}
          placeholder="Opcional"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <button className="save-btn" onClick={save}>Guardar entreno</button>
      </section>

      <section className="card">
        <div className="card-title">Historial de entrenos</div>

        {loading ? (
          <div className="workout-loading"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="workout-empty">
            <div className="workout-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 6.5 17.5 17.5M4 8l-2 2 2 2M20 8l2 2-2 2M8 4l2-2 2 2M8 20l2 2 2-2M6 6l-2 2M18 18l2-2" />
              </svg>
            </div>
            <p>Aún no hay entrenos registrados. ¡Empieza hoy!</p>
          </div>
        ) : (
          <div className="workout-list">
            {items.map(w => {
              const optimal = (readinessByDate[w.date] ?? 0) >= 85
              const open = expanded === w.key
              const pauses = (w.events || []).filter(e => e.type === 'PAUSE')
              return (
                <div key={w.key} className="workout-item">
                  <button
                    className="workout-item-main"
                    onClick={() => setExpanded(open ? null : w.key)}
                    aria-expanded={open}
                  >
                    <div className="workout-item-left">
                      <div className="workout-item-title">{w.title}</div>
                      <div className="workout-item-sub">{fmtShortDate(w.date)} · {w.durationMinutes} min</div>
                    </div>
                    <div className="workout-item-right">
                      <span className={`workout-badge${w.source === 'fitbit' ? ' fitbit' : ''}`}>
                        {w.source === 'fitbit' ? 'Fitbit' : 'Manual'}
                      </span>
                      {optimal && <span className="workout-badge optimal">Día óptimo</span>}
                    </div>
                  </button>

                  <div className={`workout-detail-wrap${open ? ' open' : ''}`}>
                    <div className="workout-detail-inner">
                      <div className="workout-detail">
                        <div className="detail-row">
                          <span className="detail-key">Fecha</span>
                          <span className="detail-val">{fmtLongDate(w.date)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-key">Duración</span>
                          <span className="detail-val">{w.durationMinutes} min</span>
                        </div>
                        {w.source === 'fitbit' ? (
                          <>
                            <div className="detail-row">
                              <span className="detail-key">Horario</span>
                              <span className="detail-val">{fmtTime24(w.startTime)} – {fmtTime24(w.endTime)}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-key">Actividad</span>
                              <span className="detail-val">{FITBIT_NAMES[w.type] || w.title}</span>
                            </div>
                            {pauses.length > 0 && (
                              <div className="detail-events">
                                {pauses.length} pausa{pauses.length > 1 ? 's' : ''}: {pauses.map(p => fmtTime24(p.time)).join(', ')}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="detail-row">
                              <span className="detail-key">Intensidad</span>
                              <span className="detail-val">{w.intensity}</span>
                            </div>
                            {w.notes && <div className="detail-notes">{w.notes}</div>}
                            <button className="workout-delete" onClick={() => remove(w.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              </svg>
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
