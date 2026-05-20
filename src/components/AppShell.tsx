import { Boxes, ClipboardList, GitBranchPlus, PackageOpen } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'

const navItems = [
  { to: '/orders/inbound', label: 'Inbound Orders', icon: ClipboardList },
  { to: '/orders/outbound', label: 'Outbound Orders', icon: PackageOpen },
  { to: '/flows', label: 'Flow Definitions', icon: Boxes },
  { to: '/flows/inbound-basic/editor', label: 'Flow Editor', icon: GitBranchPlus },
]

export function AppShell() {
  const backendLabel = getBackendLabel(API_BASE_URL)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">FW</div>
          <div>
            <h1>FlowView</h1>
            <p>WMS + WCS Demo Console</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-dot online" />
          <span>Backend {backendLabel}</span>
        </div>
      </aside>

      <main className="content-area">
        <Outlet />
      </main>
    </div>
  )
}

function getBackendLabel(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
