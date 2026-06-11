'use client'

import { useEffect, useState } from 'react'

export function scoreColor(score) {
  if (!score) return '#6b6a7a'
  if (score >= 80) return '#00d4a0'
  if (score >= 60) return '#f5c84b'
  return '#ff5a5a'
}

export default function ScoreRing({ score, size = 120, color, label }) {
  const ringColor = color ?? scoreColor(score)
  const strokeWidth = Math.round(size / 12)
  const r = size / 2 - 8
  const fontSize = Math.round(size * 0.267)
  const circ = 2 * Math.PI * r
  // arranca vacío y transiciona hasta el valor → animación de fill al cargar
  const [offset, setOffset] = useState(circ)

  useEffect(() => {
    const target = score ? circ * (1 - Math.min(score / 100, 1)) : circ
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOffset(target)))
    return () => cancelAnimationFrame(raf)
  }, [score, circ])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${label ?? 'Readiness'} ${score ?? 'sin datos'}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1e2a" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={ringColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={size / 2} y={size / 2 + fontSize / 3} textAnchor="middle" fontSize={fontSize} fontWeight={700} fill={ringColor}>
        {score ?? '--'}
      </text>
    </svg>
  )
}
