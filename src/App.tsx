import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { FlowDefinitionsPage } from './pages/FlowDefinitionsPage'
import { FlowEditorPage } from './pages/FlowEditorPage'
import { LocationsPage } from './pages/LocationsPage'
import { OrdersPage } from './pages/OrdersPage'
import { PalletsPage } from './pages/PalletsPage'
import { PortsPage } from './pages/PortsPage'
import { SkusPage } from './pages/SkusPage'
import { TaskExecutionPage } from './pages/TaskExecutionPage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/orders/inbound" replace />} />
        <Route path="/orders/inbound" element={<OrdersPage kind="inbound" />} />
        <Route path="/orders/outbound" element={<OrdersPage kind="outbound" />} />
        <Route path="/tasks/:id" element={<TaskExecutionPage />} />
        <Route path="/flows" element={<FlowDefinitionsPage />} />
        <Route path="/flows/:code/editor" element={<FlowEditorPage />} />
        <Route path="/master-data/locations" element={<LocationsPage />} />
        <Route path="/master-data/ports" element={<PortsPage />} />
        <Route path="/master-data/pallets" element={<PalletsPage />} />
        <Route path="/master-data/skus" element={<SkusPage />} />
      </Route>
    </Routes>
  )
}

export default App
