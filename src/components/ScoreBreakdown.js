const items = [
  { key: 'durationScore', label: 'Duración sueño', color: '#00d4a0', weight: '35%' },
  { key: 'deepScore', label: 'Sueño profundo', color: '#7c5cbf', weight: '20%' },
  { key: 'remScore', label: 'REM', color: '#4a9eff', weight: '15%' },
  { key: 'hrvScore', label: 'HRV', color: '#00d4a0', weight: '15%' },
  { key: 'rhrScore', label: 'FC reposo', color: '#4a9eff', weight: '10%' },
  { key: 'interruptionScore', label: 'Interrupciones', color: '#e6a23c', weight: '5%' },
]

export default function ScoreBreakdown({ breakdown }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(item => (
        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 104, fontSize: 11, color: '#6b6a7a', textAlign: 'right', flexShrink: 0 }}>
            {item.label}
          </div>
          <div style={{ flex: 1, height: 4, background: '#1e1e2a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${breakdown[item.key]}%`, height: '100%', background: item.color, borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ width: 30, fontSize: 12, fontWeight: 600, color: '#f0eff4', flexShrink: 0, textAlign: 'right' }}>
            {breakdown[item.key]}
          </div>
          <div style={{ width: 28, fontSize: 10, color: '#6b6a7a', flexShrink: 0 }}>
            {item.weight}
          </div>
        </div>
      ))}
    </div>
  )
}
