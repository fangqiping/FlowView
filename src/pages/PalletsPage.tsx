import { Plus, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MasterDataDialog } from '../components/MasterDataDialog'
import { MasterDataTable, type MasterDataColumn } from '../components/MasterDataTable'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import type { PalletInputModel, PalletModel, SkuModel } from '../types'

export function PalletsPage({ apiOverride = api }: { apiOverride?: typeof api }) {
  const [items, setItems] = useState<PalletModel[]>([])
  const [skus, setSkus] = useState<SkuModel[]>([])
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PalletModel | null>(null)
  const [draft, setDraft] = useState<PalletInputModel>({
    code: '',
    enabled: true,
    skuId: 1,
    quantity: 1,
  })

  const skuMap = useMemo(() => new Map(skus.map((item) => [item.id, item.code])), [skus])
  const columns: MasterDataColumn<PalletModel>[] = [
    { key: 'code', label: 'Code' },
    { key: 'skuId', label: 'SKU', render: (row) => skuMap.get(row.skuId) ?? `#${row.skuId}` },
    { key: 'quantity', label: 'Quantity' },
    { key: 'enabled', label: 'Enabled', render: (row) => (row.enabled ? 'Yes' : 'No') },
    { key: 'acquired', label: 'Acquired', render: (row) => (row.acquired ? 'Yes' : 'No') },
  ]

  useEffect(() => {
    void apiOverride.getSkus().then((response) => {
      setSkus(response.items)
      setDraft((current) => ({ ...current, skuId: response.items[0]?.id ?? current.skuId }))
    })
    void loadPage(1, 20)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPage(nextPageIndex = pageIndex, nextPageSize = pageSize) {
    try {
      setError(null)
      const result = await apiOverride.getPalletsPage(nextPageIndex, nextPageSize)
      setItems(result.items)
      setPageIndex(result.pageIndex)
      setPageSize(result.pageSize)
      setTotalCount(result.totalCount)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load pallets.')
    }
  }

  function openCreate() {
    setEditing(null)
    setDraft({ code: '', enabled: true, skuId: skus[0]?.id ?? 1, quantity: 1 })
    setDialogOpen(true)
  }

  function openEdit(item: PalletModel) {
    setEditing(item)
    setDraft({ code: item.code, enabled: item.enabled, skuId: item.skuId, quantity: item.quantity })
    setDialogOpen(true)
  }

  async function submit() {
    try {
      if (editing) {
        await apiOverride.updatePallet(editing.id, draft)
        setMessage(`${editing.code} updated.`)
      } else {
        await apiOverride.createPallet(draft)
        setMessage(`${draft.code} created.`)
      }
      setDialogOpen(false)
      await loadPage()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save pallet.')
    }
  }

  async function remove(item: PalletModel) {
    if (!window.confirm(`Delete ${item.code}?`)) {
      return
    }
    try {
      await apiOverride.deletePallet(item.id)
      setMessage(`${item.code} deleted.`)
      const nextPageIndex = items.length === 1 && pageIndex > 1 ? pageIndex - 1 : pageIndex
      await loadPage(nextPageIndex, pageSize)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete pallet.')
    }
  }

  async function toggleEnabled(item: PalletModel) {
    try {
      await apiOverride.updatePallet(item.id, {
        code: item.code,
        enabled: !item.enabled,
        skuId: item.skuId,
        quantity: item.quantity,
      })
      setMessage(`${item.code} ${item.enabled ? 'disabled' : 'enabled'}.`)
      await loadPage()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update pallet.')
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Master Data" title="Pallets" actions={
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
      <MasterDataDialog open={dialogOpen} title={editing ? 'Edit Pallet' : 'New Pallet'} onClose={() => setDialogOpen(false)} onSubmit={() => void submit()}>
        <div className="form-grid">
          <label><span>Code</span><input value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} /></label>
          <label>
            <span>SKU</span>
            <select value={draft.skuId} onChange={(event) => setDraft((current) => ({ ...current, skuId: Number(event.target.value) }))}>
              {skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.code}</option>)}
            </select>
          </label>
          <label><span>Quantity</span><input type="number" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: Number(event.target.value) }))} /></label>
          <label className="checkbox-field">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
            <span>Enabled</span>
          </label>
        </div>
      </MasterDataDialog>
    </div>
  )
}
