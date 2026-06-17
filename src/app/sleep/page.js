import HealthMonitorClient from '@/components/HealthMonitorClient'

export const metadata = {
  title: 'Health Monitor · Mi Salud',
  description: 'Métricas nocturnas: HRV, FC reposo, sueño profundo y REM',
}

export default function HealthPage() {
  return <HealthMonitorClient />
}
