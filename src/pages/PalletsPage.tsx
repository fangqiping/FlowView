import { Plus, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MasterDataDialog } from '../components/MasterDataDialog'
import { MasterDataTable, type MasterDataColumn } from '../components/MasterDataTable'
import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../i18n/useI18n'
import { api } from '../lib/api'
import type { PalletInputModel, PalletModel, SkuModel } from '../types'

export function PalletsPage({ apiOverride = api }: { apiOverride?: typeof api }) {
  const { t } = useI18n()
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
    { key: 'code', label: t('masterData.code') },
    { key: 'skuId', label: t('masterData.sku'), render: (row) => skuMap.get(row.skuId) ?? `#${row.skuId}` },
    { key: 'quantity', label: t('masterData.quantity') },
    { key: 'enabled', label: t('masterData.enabled'), render: (row) => (row.enabled ? t('masterData.yes') : t('masterData.no')) },
    { key: 'acquired', label: t('masterData.acquired'), render: (row) => (row.acquired ? t('masterData.yes') : t('masterData.no')) },
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
      <PageHeader eyebrow={t('masterData.eyebrow')} title={t('masterData.pallets')} actions={
        <>
          <button className="icon-button" type="button" aria-label={t('actions.refresh')} onClick={() => void loadPage()}><RefreshCcw size={16} /></button>
          <button className="primary-button" type="button" onClick={openCreate}><Plus size={16} /><span>{t('masterData.new')}</span></button>
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
      <MasterDataDialog open={dialogOpen} title={editing ? t('masterData.editPallet') : t('masterData.newPallet')} onClose={() => setDialogOpen(false)} onSubmit={() => void submit()}>
        <div className="form-grid">
          <label><span>{t('masterData.code')}</span><input value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} /></label>
          <label>
            <span>{t('masterData.sku')}</span>
            <select value={draft.skuId} onChange={(event) => setDraft((current) => ({ ...current, skuId: Number(event.target.value) }))}>
              {skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.code}</option>)}
            </select>
          </label>
          <label><span>{t('masterData.quantity')}</span><input type="number" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: Number(event.target.value) }))} /></label>
          <label className="checkbox-field">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
            <span>{t('masterData.enabled')}</span>
          </label>
        </div>
      </MasterDataDialog>
    </div>
  )
}
