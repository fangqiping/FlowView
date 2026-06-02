import { Boxes, ClipboardList, GitBranchPlus, MapPinned, Package2, PackageOpen, Tags, Workflow, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { SUPPORTED_LANGUAGES, canonicalizeLanguage } from '../i18n/languages'
import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/useI18n'
import { API_BASE_URL } from '../lib/api'

const navItems: Array<{ to: string; labelKey: MessageKey; icon: LucideIcon }> = [
  { to: '/orders/inbound', labelKey: 'nav.inboundOrders', icon: ClipboardList },
  { to: '/orders/outbound', labelKey: 'nav.outboundOrders', icon: PackageOpen },
  { to: '/flows', labelKey: 'nav.flowDefinitions', icon: Boxes },
  { to: '/flows/inbound-basic/editor', labelKey: 'nav.flowEditor', icon: GitBranchPlus },
  { to: '/master-data/locations', labelKey: 'nav.locations', icon: MapPinned },
  { to: '/master-data/ports', labelKey: 'nav.ports', icon: Workflow },
  { to: '/master-data/pallets', labelKey: 'nav.pallets', icon: Package2 },
  { to: '/master-data/skus', labelKey: 'nav.skus', icon: Tags },
]

export function AppShell() {
  const { language, setLanguage, t } = useI18n()
  const backendLabel = getBackendLabel(API_BASE_URL)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">FW</div>
          <div>
            <h1>FlowView</h1>
            <p>{t('app.subtitle')}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <label className="language-select">
            <span>{t('language.label')}</span>
            <select value={language} onChange={(event) => setLanguage(canonicalizeLanguage(event.target.value))}>
              {SUPPORTED_LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.nativeLabel}
                </option>
              ))}
            </select>
          </label>
          <div className="status-dot online" />
          <span>{t('app.backend', { backend: backendLabel })}</span>
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
