import './globals.css'

export const metadata = {
  title: 'Mi dashboard de salud',
  description: 'Dashboard personal de Fitbit Air con datos de Google Health API',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
