'use client'

import { useEffect, useState } from 'react'

export function scoreColor(score) {
  if (!score) return '#6b7280'
  if (score >= 80) return '#00d4a0'
  if (score >= 60) return '#f5c84b'
  return '#ff5a5a'
}

export default function ScoreRing({
  score,
  displayValue,       // texto alternativo al número (ej: "4.2" para strain)
  size = 110,
  strokeWidth = 8,
  color,
  trackColor = 'rgba(255,255,255,0.08)',
  fontSize = 48,
  fontWeight = 800,
  label,
  unit,               // unidad opcional debajo del número (ej: "ms")
}) {
  const ringColor = color ?? scoreColor(score)
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const [offset, setOffset] = useState(circ)

  useEffect(() => {
    const pct = score != null ? Math.min(score / 100, 1) : 0
    const target = circ * (1 - pct)
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOffset(target)))
    return () => cancelAnimationFrame(raf)
  }, [score, circ])

  const shown = displayValue ?? (score != null ? score : '--')

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`${label ?? 'Score'}: ${shown}`}
    >
      {/* track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {/* fill */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={ringColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}
      />
      {/* valor */}
      <text
        x={size / 2}
        y={unit ? size / 2 - 5 : size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill="#f0eff4"
      >
        {shown}
      </text>
      {unit && (
        <text
          x={size / 2}
          y={size / 2 + fontSize * 0.45}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize * 0.28}
          fontWeight={500}
          fill="rgba(240,239,244,0.5)"
        >
          {unit}
        </text>
      )}
    </svg>
  )
}
