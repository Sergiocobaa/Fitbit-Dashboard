'use client'

import { useEffect, useState } from 'react'
import { BaselinePill } from './BaselineDelta'
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
}

function fmtHM(mins) {
  if (!mins) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtTime(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Hypnogram (Stage Timeline) Component
function SleepHypnogram({ segments, startTime, endTime }) {
  if (!segments || !segments.length) return null
  
  const totalMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  
  const stageColor = {
    AWAKE: '#ff9f43',
    REM: '#9c88ff',
    LIGHT: '#48dbfb',
    DEEP: '#5f27cd'
  }
  const stageHeight = {
    AWAKE: '100%',
    REM: '75%',
    LIGHT: '45%',
    DEEP: '15%'
  }
  
  return (
    <div style={{ marginTop: 24, padding: '16px', backgroundColor: '#111', borderRadius: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8e8e93', letterSpacing: '0.05em', marginBottom: 16 }}>STAGE TIMELINE</div>
      
      <div style={{ position: 'relative', height: 100, display: 'flex', alignItems: 'flex-end', borderBottom: '1px dashed #333', paddingBottom: 4 }}>
        {/* Y-axis labels */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: '#8e8e93', width: 40, paddingTop: 4, paddingBottom: 4 }}>
          <span style={{ color: stageColor.AWAKE }}>Awake</span>
          <span style={{ color: stageColor.REM }}>REM</span>
          <span style={{ color: stageColor.LIGHT }}>Light</span>
          <span style={{ color: stageColor.DEEP }}>Deep</span>
        </div>
        
        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', width: '100%', marginLeft: 44 }}>
          {segments.map((seg, i) => {
            const ms = new Date(seg.end).getTime() - new Date(seg.start).getTime()
            const pct = (ms / totalMs) * 100
            return (
              <div key={i} style={{
                width: `${pct}%`,
                height: stageHeight[seg.type] || '0%',
                backgroundColor: stageColor[seg.type] || '#555',
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
                marginRight: 1
              }} />
            )
          })}
        </div>
      </div>
      
      {/* X-axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginLeft: 44, marginTop: 8, fontSize: 10, color: '#8e8e93' }}>
        <span>{fmtTime(startTime)}</span>
        <span>{fmtTime(endTime)}</span>
      </div>
    </div>
  )
}

// Progress Bar for Sleep Stages
function StageBar({ label, mins, totalMins, color, healthyMin, healthyMax }) {
  const pct = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#ccc' }}>
          {/* Custom SVG ring icon representing the stage */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" style={{ marginRight: 8 }}>
            <circle cx="12" cy="12" r="9" opacity="0.3" />
            <path d="M12 3 A9 9 0 0 1 21 12" />
          </svg>
          {label} <span style={{ color: color, marginLeft: 6 }}>{pct}%</span>
        </div>
        <div style={{ color: '#fff', fontSize: 14 }}>{fmtHM(mins)}</div>
      </div>
      <div style={{ position: 'relative', height: 12, backgroundColor: '#222', borderRadius: 6, overflow: 'hidden' }}>
        {/* Healthy Range Area */}
        <div style={{ position: 'absolute', left: `${healthyMin}%`, width: `${healthyMax - healthyMin}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)' }} />
        {/* Striped Healthy Range border */}
        <div style={{ position: 'absolute', left: `${healthyMin}%`, height: '100%', borderLeft: '2px solid #444' }} />
        <div style={{ position: 'absolute', left: `${healthyMax}%`, height: '100%', borderLeft: '2px solid #444' }} />
        
        {/* Actual Value Bar */}
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 6 }} />
      </div>
    </div>
  )
}

export default function HealthMonitorClient() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const date = todayStr()
    fetch(`/api/health?date=${date}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <main className="app">
        <div className="hm-header">
          <h1 className="hm-title">SLEEP</h1>
        </div>
        <div className="error-box">Error cargando datos: {error}</div>
      </main>
    )
  }

  const sleep = data?.sleep
  const heartRate = data?.heartRate

  // Prepara datos de FC para la gráfica (solo durante el sueño)
  const hrData = []
  if (sleep && heartRate) {
    const dStr = todayStr()
    heartRate.forEach(hr => {
      const d = new Date(dStr + 'T00:00:00+02:00')
      d.setMinutes(hr.mins)
      if (d >= new Date(sleep.startTime) && d <= new Date(sleep.endTime)) {
        hrData.push({ time: hr.mins, bpm: hr.bpm })
      }
    })
  }

  const totalSleepMins = sleep ? (sleep.minutesAsleep + sleep.minutesAwake) : 0

  return (
    <main className="app">
      <div className="hm-header" style={{ paddingBottom: 16 }}>
        <h1 className="hm-title">LAST NIGHT'S SLEEP</h1>
        <p className="hm-subtitle" style={{ fontSize: 13 }}>
          {sleep ? `${fmtHM(sleep.minutesAsleep)} in bed` : 'Cargando datos...'}
        </p>
      </div>

      {!loading && sleep ? (
        <div className="card" style={{ padding: '24px 16px' }}>
          
          {/* Heart Rate Graph */}
          {hrData.length > 0 && (
            <div style={{ height: 120, marginBottom: 32, borderBottom: '1px dashed #333', paddingBottom: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hrData}>
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                  <Line type="monotone" dataKey="bpm" stroke="#ff4757" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8e8e93', marginTop: 8 }}>
                <span>{fmtTime(sleep.startTime)}</span>
                <span>{fmtTime(sleep.endTime)}</span>
              </div>
            </div>
          )}

          {/* Sleep Stages Bars */}
          <StageBar label="Awake" mins={sleep.minutesAwake} totalMins={totalSleepMins} color="#ff9f43" healthyMin={5} healthyMax={15} />
          <StageBar label="Light" mins={sleep.light} totalMins={totalSleepMins} color="#48dbfb" healthyMin={45} healthyMax={65} />
          <StageBar label="Deep (SWS)" mins={sleep.deep} totalMins={totalSleepMins} color="#5f27cd" healthyMin={15} healthyMax={25} />
          <StageBar label="REM" mins={sleep.rem} totalMins={totalSleepMins} color="#9c88ff" healthyMin={20} healthyMax={25} />

          <div style={{ fontSize: 11, color: '#8e8e93', display: 'flex', alignItems: 'center', marginTop: 24, justifyContent: 'center' }}>
            <span style={{ display: 'inline-block', width: 16, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderLeft: '2px solid #444', borderRight: '2px solid #444', marginRight: 8 }} />
            Healthy range
          </div>

          {/* Hypnogram */}
          {sleep.segments && sleep.segments.length > 0 && (
             <SleepHypnogram segments={sleep.segments} startTime={sleep.startTime} endTime={sleep.endTime} />
          )}

        </div>
      ) : (
        <div style={{ padding: 20 }}>
          {loading ? (
             <div className="hm-shimmer" style={{ height: 300, borderRadius: 16 }} />
          ) : (
             <div style={{ color: '#8e8e93', textAlign: 'center' }}>No sleep data available for last night.</div>
          )}
        </div>
      )}
      
    </main>
  )
}
