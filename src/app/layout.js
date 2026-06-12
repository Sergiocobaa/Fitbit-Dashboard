import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'Mi dashboard de salud',
  description: 'Dashboard personal de Fitbit Air con datos de Google Health API',
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
  themeColor: '#08080f',
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
