import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'Mi dashboard de salud',
  description: 'Dashboard personal de Fitbit Air con datos de Google Health API',
  icons: { icon: '/logo-favicon.svg' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
