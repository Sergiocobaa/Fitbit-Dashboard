'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook que envía una notificación push cuando se registra/carga sueño nuevo.
 * Guarda en localStorage qué sesiones ya se notificaron para no repetir.
 *
 * Uso:
 *   const notifySleep = useSleepNotification()
 *   // Llamar cuando tengas datos de sueño:
 *   notifySleep(sleepData, date)
 */
export function useSleepNotification() {
  const permissionRef = useRef(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied'
  )

  // Solicitar permiso en cuanto se monta el componente que usa este hook
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        permissionRef.current = p
      })
    } else {
      permissionRef.current = Notification.permission
    }
  }, [])

  return (sleepData, date) => {
    if (!sleepData || !date) return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    // Clave única por sesión de sueño (fecha del registro)
    const storageKey = `sleepNotif_${date}_${sleepData.startTime ?? 'x'}`
    if (localStorage.getItem(storageKey)) return // ya notificado

    const fire = () => {
      const totalMin = sleepData.minutesAsleep ?? 0
      const hours = Math.floor(totalMin / 60)
      const mins = totalMin % 60
      const deepMin = sleepData.deep ?? 0
      const remMin = sleepData.rem ?? 0
      const awakeMin = sleepData.minutesAwake ?? 0

      const lines = [
        `Dormiste ${hours}h ${mins}m en total`,
        deepMin ? `Sueño profundo: ${Math.floor(deepMin / 60)}h ${deepMin % 60}m` : null,
        remMin  ? `REM: ${Math.floor(remMin / 60)}h ${remMin % 60}m` : null,
        awakeMin ? `Tiempo despierto: ${awakeMin}min` : null,
      ].filter(Boolean).join(' · ')

      try {
        const notif = new Notification('🌙 Tu sueño de anoche', {
          body: lines,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `sleep-${date}`,
          renotify: false,
          actions: [{ action: 'sleep', title: 'Ver detalles' }],
        })
        notif.onclick = () => {
          window.focus()
          notif.close()
        }
        localStorage.setItem(storageKey, '1')
        return true
      } catch {
        return false
      }
    }

    const perm = Notification.permission
    if (perm === 'granted') {
      fire()
    } else if (perm === 'default') {
      Notification.requestPermission().then(p => {
        permissionRef.current = p
        if (p === 'granted') fire()
      })
    }
    // Si 'denied', no hacemos nada
  }
}

/**
 * Componente que registra el Service Worker al montar.
 * Incluirlo en el layout para que esté disponible en toda la app.
 */
export default function NotificationManager() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW opcional — no crítico
      })
    }
  }, [])

  return null
}
