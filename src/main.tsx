import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { I18nProvider } from './i18n/I18nProvider'
import { NotificationCenterProvider } from './notifications/NotificationCenterProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <NotificationCenterProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </NotificationCenterProvider>
    </I18nProvider>
  </StrictMode>,
)
