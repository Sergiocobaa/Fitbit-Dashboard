'use client'

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function WorkoutHRChart({ data, hrMax = 194, restingHR }) {
  const yMax = hrMax + 10

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {/* gradiente vertical de rojo (FC alta, arriba) a gris (FC baja, abajo) por zonas */}
          <linearGradient id="wStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff5a5a" />
            <stop offset="0.25" stopColor="#f5c84b" />
            <stop offset="0.5" stopColor="#00d4a0" />
            <stop offset="0.75" stopColor="#4a9eff" />
            <stop offset="1" stopColor="#6b6a7a" />
          </linearGradient>
          <linearGradient id="wFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff5a5a" stopOpacity={0.25} />
            <stop offset="0.5" stopColor="#00d4a0" stopOpacity={0.12} />
            <stop offset="1" stopColor="#6b6a7a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: '#6b6a7a' }}
          axisLine={false}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          domain={[40, yMax]}
          width={32}
          tick={{ fontSize: 10, fill: '#6b6a7a' }}
          axisLine={false}
          tickLine={false}
        />
        {restingHR ? (
          <ReferenceLine y={restingHR} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
        ) : null}
        <Tooltip
          contentStyle={{
            background: '#13131f',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 12,
            color: '#f0eff4',
            padding: '6px 10px',
          }}
          labelStyle={{ color: '#6b6a7a' }}
          formatter={value => [`${value} bpm`, 'FC']}
        />
        <Area
          type="monotone"
          dataKey="bpm"
          stroke="url(#wStroke)"
          strokeWidth={2}
          fill="url(#wFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
