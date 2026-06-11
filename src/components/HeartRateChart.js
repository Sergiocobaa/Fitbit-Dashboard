'use client'

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const GREEN = '#00d4a0'
const YELLOW = '#f5c84b'
const RED = '#ff5a5a'

const HEIGHT = 200
const MARGIN_TOP = 10
const XAXIS_H = 30
const PLOT_H = HEIGHT - MARGIN_TOP - XAXIS_H
const Y_MIN = 40
const Y_MAX = 120

// offset vertical (0 = arriba) de un valor de bpm dentro del gradiente userSpaceOnUse
function offFor(bpm) {
  const y = MARGIN_TOP + ((Y_MAX - bpm) / (Y_MAX - Y_MIN)) * PLOT_H
  return Math.max(0, Math.min(1, y / HEIGHT))
}

function fmtMins(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function colorFor(bpm) {
  if (bpm > 90) return RED
  if (bpm >= 70) return YELLOW
  return GREEN
}

function Dot({ cx, cy, value, index }) {
  if (cx == null || cy == null) return null
  return <circle key={`hr-dot-${index}`} cx={cx} cy={cy} r={1.8} fill={colorFor(value)} />
}

export default function HeartRateChart({ data }) {
  const stops = [
    { off: 0, color: RED },
    { off: offFor(91), color: RED },
    { off: offFor(89), color: YELLOW },
    { off: offFor(71), color: YELLOW },
    { off: offFor(69), color: GREEN },
    { off: 1, color: GREEN },
  ]

  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <AreaChart data={data} margin={{ top: MARGIN_TOP, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="hrStroke" x1="0" y1="0" x2="0" y2={HEIGHT} gradientUnits="userSpaceOnUse">
            {stops.map((s, i) => (
              <stop key={i} offset={s.off} stopColor={s.color} />
            ))}
          </linearGradient>
          <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2={HEIGHT} gradientUnits="userSpaceOnUse">
            {stops.map((s, i) => (
              <stop key={i} offset={s.off} stopColor={s.color} stopOpacity={0.14} />
            ))}
            <stop offset={1} stopColor={GREEN} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          type="number"
          dataKey="mins"
          domain={[0, 1439]}
          ticks={[0, 360, 720, 1080, 1439]}
          tickFormatter={m => (m === 1439 ? '23:59' : fmtMins(m))}
          height={XAXIS_H}
          tick={{ fontSize: 10, fill: '#6b6a7a' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[Y_MIN, Y_MAX]}
          ticks={[40, 70, 90, 120]}
          width={32}
          tick={{ fontSize: 10, fill: '#6b6a7a' }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine
          y={70}
          stroke="#6b6a7a"
          strokeDasharray="4 4"
          label={{ value: 'zona de calma', position: 'insideBottomRight', fontSize: 10, fill: '#6b6a7a' }}
        />
        <Tooltip
          contentStyle={{
            background: '#16161f',
            border: '1px solid #1e1e2a',
            borderRadius: 8,
            fontSize: 12,
            color: '#f0eff4',
            padding: '6px 10px',
          }}
          labelStyle={{ color: '#6b6a7a' }}
          labelFormatter={fmtMins}
          formatter={value => [`${value} bpm`, 'FC']}
        />
        <Area
          type="monotone"
          dataKey="bpm"
          stroke="url(#hrStroke)"
          strokeWidth={2}
          fill="url(#hrFill)"
          dot={<Dot />}
          activeDot={{ r: 3.5, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
