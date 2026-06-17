import './globals.css'
import BottomNav from '@/components/BottomNav'
import NotificationManager from '@/components/NotificationManager'

export const metadata = {
  title: 'Mi dashboard de salud',
  description: 'Dashboard personal de Fitbit con datos de Google Health API',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Mi Salud',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/logo-favicon.svg',
    apple: '/icon-192.png',
  },
}

export const viewport = {
  themeColor: '#080c14',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <NotificationManager />
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
