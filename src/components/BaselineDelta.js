'use client'

/**
 * BaselineDelta — muestra la variación de una métrica respecto a su baseline.
 *
 * Props:
 *   value    — valor actual (ej: 52 ms de HRV)
 *   baseline — valor medio de referencia (ej: 48 ms)
 *   higherIsBetter — true para HRV/sueño, false para RHR (donde menor es mejor)
 *   unit     — string opcional de unidad (ej: "ms", "bpm")
 *   size     — 'sm' | 'md' (tamaño de texto)
 */
export default function BaselineDelta({
  value,
  baseline,
  higherIsBetter = true,
  unit = '',
  size = 'sm',
}) {
  if (value == null || baseline == null || baseline === 0) return null

  const diff = value - baseline
  const pct = Math.round((diff / baseline) * 100)
  const positive = higherIsBetter ? diff > 0 : diff < 0
  const neutral = Math.abs(pct) <= 2 // ±2% = prácticamente igual

  const color = neutral ? 'var(--muted)' : positive ? 'var(--green)' : 'var(--red)'
  const arrow = neutral ? '—' : diff > 0 ? '↑' : '↓'
  const label = neutral ? 'En tu baseline' : `${arrow} ${Math.abs(pct)}% vs. baseline`

  const fontSize = size === 'md' ? 13 : 11

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize,
        fontWeight: 600,
        color,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </span>
  )
}

/**
 * BaselinePill — versión pill/badge para mostrar en las tarjetas de métricas
 */
export function BaselinePill({ value, baseline, higherIsBetter = true, label }) {
  if (value == null || baseline == null || baseline === 0) return null

  const diff = value - baseline
  const pct = Math.round((diff / baseline) * 100)
  const positive = higherIsBetter ? diff > 0 : diff < 0
  const neutral = Math.abs(pct) <= 2

  const bg = neutral
    ? 'rgba(255,255,255,0.06)'
    : positive
      ? 'rgba(0, 212, 160, 0.12)'
      : 'rgba(255, 90, 90, 0.12)'
  const color = neutral ? 'var(--muted)' : positive ? 'var(--green)' : 'var(--red)'
  const arrow = neutral ? '' : diff > 0 ? '↑ ' : '↓ '
  const text = label ?? (neutral ? 'En baseline' : `${arrow}${Math.abs(pct)}% vs. semana`)

  return (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 20,
        letterSpacing: '0.02em',
      }}
    >
      {text}
    </span>
  )
}
