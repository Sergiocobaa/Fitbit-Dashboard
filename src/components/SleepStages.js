const STAGES = [
  { type: 'AWAKE', label: 'Despierto', color: '#e6a23c' },
  { type: 'LIGHT', label: 'Ligero', color: '#00d4a0' },
  { type: 'REM', label: 'REM', color: '#4a9eff' },
  { type: 'DEEP', label: 'Profundo', color: '#7c5cbf' },
]

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
}

function ProportionalBar({ sleep }) {
  const values = { AWAKE: sleep.minutesAwake, LIGHT: sleep.light, REM: sleep.rem, DEEP: sleep.deep }
  const total = Object.values(values).reduce((a, b) => a + b, 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', height: 10, marginBottom: 12, gap: 1 }}>
        {STAGES.map(s => (
          <div key={s.type} style={{ width: `${(values[s.type] / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginBottom: 16 }}>
        {STAGES.map(s => (
          <div key={s.type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 11, color: '#6b6a7a' }}>{s.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#f0eff4' }}>{values[s.type]}m</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Hypnogram({ sleep }) {
  const t0 = new Date(sleep.startTime).getTime()
  const t1 = new Date(sleep.endTime).getTime()
  const span = t1 - t0
  if (!span || !sleep.segments?.length) return null

  const laneOf = type => STAGES.findIndex(s => s.type === type)
  const tMid = new Date((t0 + t1) / 2).toISOString()

  return (
    <div>
      <div style={{ display: 'flex', marginBottom: 6, paddingLeft: 44 }}>
        {STAGES.map(s => (
          <div key={s.type} style={{ width: '25%', fontSize: 9, color: '#6b6a7a', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {s.label}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ width: 44, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: '#6b6a7a', paddingRight: 8, textAlign: 'right' }}>
          <span>{fmtTime(sleep.startTime)}</span>
          <span>{fmtTime(tMid)}</span>
          <span>{fmtTime(sleep.endTime)}</span>
        </div>
        <div style={{ position: 'relative', flex: 1, height: 280, background: '#0a0a0f', border: '1px solid #1e1e2a', borderRadius: 8, overflow: 'hidden' }}>
          {STAGES.map((s, i) => i > 0 && (
            <div key={s.type} style={{ position: 'absolute', left: `${i * 25}%`, top: 0, bottom: 0, width: 1, background: '#16161f' }} />
          ))}
          {sleep.segments.map((seg, i) => {
            const lane = laneOf(seg.type)
            if (lane < 0) return null
            const top = ((new Date(seg.start).getTime() - t0) / span) * 100
            const h = ((new Date(seg.end).getTime() - new Date(seg.start).getTime()) / span) * 100
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  height: `${Math.max(h, 0.7)}%`,
                  left: `calc(${lane * 25}% + 3px)`,
                  width: 'calc(25% - 6px)',
                  background: STAGES[lane].color,
                  borderRadius: 3,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function SleepStages({ sleep }) {
  return (
    <div>
      <ProportionalBar sleep={sleep} />
      <Hypnogram sleep={sleep} />
    </div>
  )
}
