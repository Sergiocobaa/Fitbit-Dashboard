import TrendsClient from '@/components/TrendsClient'

export const metadata = {
  title: 'Tendencias · Mi Salud',
  description: 'Evolución de HRV, sueño y frecuencia cardíaca en reposo',
}

export default function TrendsPage() {
  return <TrendsClient />
}
