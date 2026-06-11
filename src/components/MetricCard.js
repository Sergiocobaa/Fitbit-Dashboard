export default function MetricCard({ icon, label, value, sub, color }) {
  return (
    <div className="card-sm metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon" aria-hidden>{icon}</span>
      </div>
      <div>
        <div className="metric-value" style={{ color: color || '#f0eff4' }}>{value}</div>
        {sub && <div className="metric-sub">{sub}</div>}
      </div>
    </div>
  )
}
