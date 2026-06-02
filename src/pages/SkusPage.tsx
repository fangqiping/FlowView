import { Plus, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MasterDataDialog } from '../components/MasterDataDialog'
import { MasterDataTable, type MasterDataColumn } from '../components/MasterDataTable'
import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../i18n/useI18n'
import { api } from '../lib/api'
import type { SkuInputModel, SkuModel } from '../types'

export function SkusPage({ apiOverride = api }: { apiOverride?: typeof api }) {
  const { t } = useI18n()
  const [items, setItems] = useState<SkuModel[]>([])
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SkuModel | null>(null)
  const [draft, setDraft] = useState<SkuInputModel>({
    code: '',
    name: '',
    spec: '',
  })

  const columns: MasterDataColumn<SkuModel>[] = [
    { key: 'code', label: t('masterData.code') },
    { key: 'name', label: t('masterData.name') },
    { key: 'spec', label: t('masterData.spec') },
  ]

  useEffect(() => {
    void loadPage(1, 20)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPage(nextPageIndex = pageIndex, nextPageSize = pageSize) {
    try {
      setError(null)
      const result = await apiOverride.getSkusPage(nextPageIndex, nextPageSize)
      setItems(result.items)
      setPageIndex(result.pageIndex)
      setPageSize(result.pageSize)
      setTotalCount(result.totalCount)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load skus.')
    }
  }

  function openCreate() {
    setEditing(null)
    setDraft({ code: '', name: '', spec: '' })
    setDialogOpen(true)
  }

  function openEdit(item: SkuModel) {
    setEditing(item)
    setDraft({ code: item.code, name: item.name, spec: item.spec })
    setDialogOpen(true)
  }

  async function submit() {
    try {
      if (editing) {
        await apiOverride.updateSku(editing.id, draft)
        setMessage(`${editing.code} updated.`)
      } else {
        await apiOverride.createSku(draft)
        setMessage(`${draft.code} created.`)
      }
      setDialogOpen(false)
      await loadPage()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save sku.')
    }
  }

  async function remove(item: SkuModel) {
    if (!window.confirm(`Delete ${item.code}?`)) {
      return
    }
    try {
      await apiOverride.deleteSku(item.id)
      setMessage(`${item.code} deleted.`)
      const nextPageIndex = items.length === 1 && pageIndex > 1 ? pageIndex - 1 : pageIndex
      await loadPage(nextPageIndex, pageSize)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete sku.')
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow={t('masterData.eyebrow')} title={t('masterData.skus')} actions={
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
      />
      <MasterDataDialog open={dialogOpen} title={editing ? t('masterData.editSku') : t('masterData.newSku')} onClose={() => setDialogOpen(false)} onSubmit={() => void submit()}>
        <div className="form-grid">
          <label><span>{t('masterData.code')}</span><input value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} /></label>
          <label><span>{t('masterData.name')}</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label><span>{t('masterData.spec')}</span><input value={draft.spec} onChange={(event) => setDraft((current) => ({ ...current, spec: event.target.value }))} /></label>
        </div>
      </MasterDataDialog>
    </div>
  )
}
