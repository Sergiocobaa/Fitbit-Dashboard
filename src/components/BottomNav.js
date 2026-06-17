'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ICONS = {
  today: (
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
  ),
  health: (
    <>
      <polyline points="22 12 18 12 15 20 9 4 6 12 2 12" />
    </>
  ),
  trends: (
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
  ),
}

const TABS = [
  { href: '/dashboard', label: 'Home',       icon: 'today'   },
  { href: '/sleep',     label: 'Health',     icon: 'health'  },
  { href: '/trends',    label: 'Tendencias', icon: 'trends'  },
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
