'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ICONS = {
  today: (
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
  ),
  health: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>
  ),
  workout: <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  sleep: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  trends: <polyline points="22 12 18 12 15 20 9 4 6 12 2 12" />,
}

const TABS = [
  { href: '/dashboard', label: 'Home', icon: 'today' },
  { href: '/sleep', label: 'Health', icon: 'health' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      <div className="bottom-nav-inner">
        {TABS.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`nav-tab${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[tab.icon]}
              </svg>
              <span className="nav-tab-label">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
