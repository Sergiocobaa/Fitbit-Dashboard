'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const PERIODS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '3 meses', days: 90 },
]

// exerciseType de Fitbit → nombre legible
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

function typeName(type) {
  return TYPE_NAMES[type] || 'Entreno'
}

function fmtShortDate(dateStr) {
  const s = new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  return s.replace(/\b\w/g, c => c.toUpperCase()).replace(/\./g, '')
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' })
}

export default function WorkoutClient() {
  const [days, setDays] = useState(30)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/exercises?days=${days}`)
      .then(r => r.json())
      .then(j => {
        if (!cancelled) setExercises(Array.isArray(j.exercises) ? j.exercises : [])
      })
      .catch(() => {
        if (!cancelled) setExercises([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [days])

  return (
    <main className="app exercises-page">
      <header className="workout-header">
        <h1>Entrenos</h1>
        <div className="period-pills">
          {PERIODS.map(p => (
            <button
              key={p.days}
              className={`period-pill${days === p.days ? ' active' : ''}`}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="workout-loading"><div className="spinner" /></div>
      ) : exercises.length === 0 ? (
        <div className="exercise-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 6.5 17.5 17.5M4 8l-2 2 2 2M20 8l2 2-2 2M8 4l2-2 2 2M8 20l2 2 2-2M6.5 6.5 4.5 8.5M17.5 17.5l2 2" />
          </svg>
          <p>Sin entrenos registrados</p>
        </div>
      ) : (
        <div className="exercise-list">
          {exercises.map(e => (
            <Link key={e.id} href={`/workout/${e.id}`} className="exercise-card">
              <div className="exercise-left">
                <div className="exercise-name">{e.name}</div>
                <div className="exercise-meta">{typeName(e.type)}</div>
                <div className="exercise-meta">{fmtShortDate(e.date)}</div>
              </div>
              <div className="exercise-right">
                <div className="exercise-duration">{e.durationMinutes} min</div>
                <div className="exercise-meta">{fmtTime(e.startTime)}</div>
              </div>
              <svg className="exercise-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
