'use client'

import { useEffect, useState } from 'react'

export function scoreColor(score) {
  if (!score) return '#6b6a7a'
  if (score >= 80) return '#00d4a0'
  if (score >= 60) return '#f5c84b'
  return '#ff5a5a'
}

export default function ScoreRing({
  score,
  size = 110,
  strokeWidth = 8,
  color,
  trackColor = 'rgba(255,255,255,0.06)',
  fontSize = 48,
  fontWeight = 800,
  label,
}) {
  const ringColor = color ?? scoreColor(score)
  const r = (size - strokeWidth) / 2
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
      {/* track sin linecap redondeado */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {/* fill con linecap redondeado */}
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
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fontSize={fontSize} fontWeight={fontWeight} fill="#f0eff4"
      >
        {score ?? '--'}
      </text>
    </svg>
  )
}
