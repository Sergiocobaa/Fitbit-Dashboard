export default function MetricCard({ icon, label, value, sub }) {
  return (
    <div className="card metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon" aria-hidden>{icon}</span>
      </div>
      <div>
        <div className="metric-value">{value}</div>
        {sub && <div className="metric-sub">{sub}</div>}
      </div>
    </div>
  )
}
