import StressClient from '@/components/StressClient'

export const metadata = {
  title: 'Estrés Diario · Mi Salud',
  description: 'Nivel de estrés a lo largo del día basado en Frecuencia Cardíaca',
}

export default function StressPage() {
  return <StressClient />
}
