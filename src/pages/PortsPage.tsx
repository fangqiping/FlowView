import { Plus, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MasterDataDialog } from '../components/MasterDataDialog'
import { MasterDataTable, type MasterDataColumn } from '../components/MasterDataTable'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import type { PalletModel, PortInputModel, PortModel, WarehouseModel } from '../types'

export function PortsPage({ apiOverride = api }: { apiOverride?: typeof api }) {
  const [items, setItems] = useState<PortModel[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseModel[]>([])
  const [pallets, setPallets] = useState<PalletModel[]>([])
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PortModel | null>(null)
  const [draft, setDraft] = useState<PortInputModel>({
    code: '',
    name: '',
    enabled: true,
    portType: 1,
    status: 1,
    currentPalletId: null,
    warehouseId: 1,
  })

  const warehouseMap = useMemo(() => new Map(warehouses.map((item) => [item.id, item.name])), [warehouses])
  const palletMap = useMemo(() => new Map(pallets.map((item) => [item.id, item.code])), [pallets])
  const columns: MasterDataColumn<PortModel>[] = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'portType', label: 'Port Type', render: (row) => (row.portType === 1 ? 'Inbound' : 'Outbound') },
    { key: 'status', label: 'Status', render: (row) => toPortStatusLabel(row.status) },
    { key: 'warehouseId', label: 'Warehouse', render: (row) => warehouseMap.get(row.warehouseId) ?? `#${row.warehouseId}` },
    { key: 'currentPalletId', label: 'Current Pallet', render: (row) => row.currentPalletId ? (palletMap.get(row.currentPalletId) ?? `#${row.currentPalletId}`) : 'None' },
    { key: 'enabled', label: 'Enabled', render: (row) => (row.enabled ? 'Yes' : 'No') },
    { key: 'acquired', label: 'Acquired', render: (row) => (row.acquired ? 'Yes' : 'No') },
  ]

  useEffect(() => {
    void Promise.all([apiOverride.getWarehouses(), apiOverride.getPallets()]).then(([warehouseResponse, palletResponse]) => {
      setWarehouses(warehouseResponse.items)
      setPallets(palletResponse.items)
      setDraft((current) => ({ ...current, warehouseId: warehouseResponse.items[0]?.id ?? current.warehouseId }))
    })
    void loadPage(1, 20)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPage(nextPageIndex = pageIndex, nextPageSize = pageSize) {
    try {
      setError(null)
      const result = await apiOverride.getPortsPage(nextPageIndex, nextPageSize)
      setItems(result.items)
      setPageIndex(result.pageIndex)
      setPageSize(result.pageSize)
      setTotalCount(result.totalCount)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load ports.')
    }
  }

  function openCreate() {
    setEditing(null)
    setDraft({
      code: '',
      name: '',
      enabled: true,
      portType: 1,
      status: 1,
      currentPalletId: null,
      warehouseId: warehouses[0]?.id ?? 1,
    })
    setDialogOpen(true)
  }

  function openEdit(item: PortModel) {
    setEditing(item)
    setDraft({
      code: item.code,
      name: item.name,
      enabled: item.enabled,
      portType: item.portType,
      status: item.status,
      currentPalletId: item.currentPalletId ?? null,
      warehouseId: item.warehouseId,
    })
    setDialogOpen(true)
  }

  async function submit() {
    try {
      if (editing) {
        await apiOverride.updatePort(editing.id, draft)
        setMessage(`${editing.code} updated.`)
      } else {
        await apiOverride.createPort(draft)
        setMessage(`${draft.code} created.`)
      }
      setDialogOpen(false)
      await loadPage()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save port.')
    }
  }

  async function remove(item: PortModel) {
    if (!window.confirm(`Delete ${item.code}?`)) {
      return
    }
    try {
      await apiOverride.deletePort(item.id)
      setMessage(`${item.code} deleted.`)
      const nextPageIndex = items.length === 1 && pageIndex > 1 ? pageIndex - 1 : pageIndex
      await loadPage(nextPageIndex, pageSize)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete port.')
    }
  }

  async function toggleEnabled(item: PortModel) {
    try {
      await apiOverride.updatePort(item.id, {
        code: item.code,
        name: item.name,
        enabled: !item.enabled,
        portType: item.portType,
        status: item.status,
        currentPalletId: item.currentPalletId ?? null,
        warehouseId: item.warehouseId,
      })
      setMessage(`${item.code} ${item.enabled ? 'disabled' : 'enabled'}.`)
      await loadPage()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update port.')
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Master Data" title="Ports" actions={
        <>
          <button className="icon-button" type="button" aria-label="Refresh" onClick={() => void loadPage()}><RefreshCcw size={16} /></button>
          <button className="primary-button" type="button" onClick={openCreate}><Plus size={16} /><span>New</span></button>
        </>
      } />
      {message ? <div className="banner success">{message}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}
      <MasterDataTable
        columns={columns}
        rows={items}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={(next) => void loadPage(next, pageSize)}
        onPageSizeChange={(next) => void loadPage(1, next)}
        onEdit={openEdit}
        onDelete={(row) => void remove(row)}
        onToggleEnabled={(row) => void toggleEnabled(row)}
      />
      <MasterDataDialog open={dialogOpen} title={editing ? 'Edit Port' : 'New Port'} onClose={() => setDialogOpen(false)} onSubmit={() => void submit()}>
        <div className="form-grid">
          <label><span>Code</span><input value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} /></label>
          <label><span>Name</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>
            <span>Port Type</span>
            <select value={draft.portType} onChange={(event) => setDraft((current) => ({ ...current, portType: Number(event.target.value) }))}>
              <option value={1}>Inbound</option>
              <option value={2}>Outbound</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: Number(event.target.value) }))}>
              <option value={1}>Idle</option>
              <option value={2}>Reserved</option>
              <option value={3}>Occupied</option>
            </select>
          </label>
          <label>
            <span>Warehouse</span>
            <select value={draft.warehouseId} onChange={(event) => setDraft((current) => ({ ...current, warehouseId: Number(event.target.value) }))}>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code}</option>)}
            </select>
          </label>
          <label>
            <span>Current Pallet</span>
            <select value={draft.currentPalletId ?? 0} onChange={(event) => setDraft((current) => ({ ...current, currentPalletId: Number(event.target.value) || null }))}>
              <option value={0}>None</option>
              {pallets.map((pallet) => <option key={pallet.id} value={pallet.id}>{pallet.code}</option>)}
            </select>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
            <span>Enabled</span>
          </label>
        </div>
      </MasterDataDialog>
    </div>
  )
}

function toPortStatusLabel(value: number) {
  return value === 1 ? 'Idle' : value === 2 ? 'Reserved' : value === 3 ? 'Occupied' : `Status ${value}`
}
