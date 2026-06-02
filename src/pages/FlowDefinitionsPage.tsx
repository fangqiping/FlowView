import { AlertTriangle, CheckCircle2, ExternalLink, Plus, RefreshCcw, Rocket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../i18n/useI18n'
import { api, ApiError, extractDesignError } from '../lib/api'
import { buildCatalogSummary } from '../lib/flowCatalogSummary'
import type { FlowCatalogModel, FlowDefinitionSummaryModel, FlowDraftModel, FlowVersionModel } from '../types'

export function FlowDefinitionsPage() {
  const { t } = useI18n()
  const [definitions, setDefinitions] = useState<FlowDefinitionSummaryModel[]>([])
  const [selectedCode, setSelectedCode] = useState('')
  const [draft, setDraft] = useState<FlowDraftModel | null>(null)
  const [versions, setVersions] = useState<FlowVersionModel[]>([])
  const [catalog, setCatalog] = useState<FlowCatalogModel | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createInput, setCreateInput] = useState({ code: '', name: '', description: '' })
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const catalogSummary = catalog ? buildCatalogSummary(catalog, selectedCode) : null

  useEffect(() => {
    void Promise.all([loadDefinitions(), loadCatalog()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedCode) {
      void loadDefinition(selectedCode)
    } else {
      setDraft(null)
      setVersions([])
    }
  }, [selectedCode])

  async function loadCatalog() {
    try {
      setCatalog(await api.getFlowCatalog())
    } catch {
      // Keep page usable even if catalog is unavailable.
    }
  }

  async function loadDefinitions(preferredCode = selectedCode) {
    try {
      setError(null)
      const items = await api.getFlowDefinitions()
      setDefinitions(items)
      const nextCode = items.some((item) => item.code === preferredCode)
        ? preferredCode
        : items[0]?.code ?? ''
      if (nextCode !== selectedCode) {
        setSelectedCode(nextCode)
      }
      if (!nextCode) {
        setDraft(null)
        setVersions([])
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load flow definitions.')
    }
  }

  async function loadDefinition(code: string) {
    if (!code) {
      return
    }

    try {
      setBusy('loading')
      setError(null)
      setMessage(null)
      const [nextDraft, nextVersions] = await Promise.all([
        api.getFlowDraft(code),
        api.getFlowVersions(code),
      ])
      setDraft(nextDraft)
      setVersions(nextVersions)
    } catch (caught) {
      setDraft(null)
      setVersions([])
      setError(caught instanceof Error ? caught.message : 'Failed to load flow definition.')
    } finally {
      setBusy(null)
    }
  }

  async function createFlow() {
    try {
      setBusy('create')
      setError(null)
      const created = await api.createFlowDefinition({
        code: createInput.code.trim(),
        name: createInput.name.trim(),
        description: createInput.description,
      })
      setCreateOpen(false)
      setCreateInput({ code: '', name: '', description: '' })
      await loadDefinitions(created.code)
      setSelectedCode(created.code)
      setMessage(`Created ${created.code}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create flow definition.')
    } finally {
      setBusy(null)
    }
  }

  async function runPreflight() {
    if (!draft) {
      return
    }

    try {
      setBusy('preflight')
      setError(null)
      const result = await api.preflightFlow(draft.code, draft.revision)
      setMessage(`Preflight passed on revision ${result.sourceDraftRevision}.`)
    } catch (caught) {
      const model = extractDesignError(caught)
      if (model) {
        setError(`${model.errorCode}: ${model.detail}`)
      } else if (caught instanceof Error) {
        setError(caught.message)
      } else {
        setError('Preflight failed.')
      }
    } finally {
      setBusy(null)
    }
  }

  async function runPublish() {
    if (!draft) {
      return
    }

    try {
      setBusy('publish')
      setError(null)
      const result = await api.publishFlow(draft.code, { expectedRevision: draft.revision })
      setMessage(`Published version v${result.versionNumber}.`)
      await loadDefinition(draft.code)
    } catch (caught) {
      const model = extractDesignError(caught)
      if (model) {
        setError(`${model.errorCode}: ${model.detail}`)
      } else if (caught instanceof ApiError && caught.payload) {
        setError(JSON.stringify(caught.payload))
      } else if (caught instanceof Error) {
        setError(caught.message)
      } else {
        setError('Publish failed.')
      }
    } finally {
      setBusy(null)
    }
  }

  async function activateVersion(versionNumber: number) {
    try {
      setBusy(`activate-${versionNumber}`)
      setError(null)
      const result = await api.activateFlowVersion(selectedCode, versionNumber)
      setMessage(`Activated v${result.versionNumber}.`)
      await loadDefinition(selectedCode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to activate version.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('flow.designRuntime')}
        title={t('flow.definitionsTitle')}
        actions={
          <>
            <button className="primary-button" type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              <span>{t('flow.newFlow')}</span>
            </button>
            <button className="icon-button" type="button" aria-label={t('flow.refreshDefinitions')} onClick={() => void loadDefinitions()}>
              <RefreshCcw size={16} />
            </button>
          </>
        }
      />

      {message ? <div className="banner success">{message}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}

      <div className="workspace-grid flow-definitions-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>{t('flow.definitionList')}</h3>
            <span>{t('flow.definitionCount', { count: definitions.length })}</span>
          </div>
          <div className="stack-list">
            {definitions.map((definition) => (
              <button
                key={definition.code}
                type="button"
                className={`list-item-button${selectedCode === definition.code ? ' selected' : ''}`}
                onClick={() => setSelectedCode(definition.code)}
              >
                <div>
                  <strong>{definition.code}</strong>
                  <p>{definition.description || definition.name}</p>
                </div>
                {definition.status === 'Active' || definition.activeVersionNumber ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
              </button>
            ))}
            {definitions.length === 0 ? <div className="empty-panel">{t('flow.emptyDefinitions')}</div> : null}
          </div>

          {catalogSummary ? (
            <div className="catalog-summary">
              <h4>{t('flow.catalogSummary')}</h4>
              <div className="meta-grid compact">
                <div><span className="meta-label">{t('flow.operations')}</span><strong>{catalogSummary.operations}</strong></div>
                <div><span className="meta-label">{t('flow.subflows')}</span><strong>{catalogSummary.subflows}</strong></div>
                <div><span className="meta-label">{t('flow.variableTypes')}</span><strong>{catalogSummary.variableTypes}</strong></div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="detail-column">
          <div className="panel">
            <div className="panel-header">
              <h3>{t('flow.draft')}</h3>
              <span>{busy === 'loading' ? t('common.loading') : draft?.code ?? selectedCode}</span>
            </div>

            {draft ? (
              <>
                <div className="meta-grid">
                  <div>
                    <span className="meta-label">{t('flow.name')}</span>
                    <strong>{draft.name}</strong>
                  </div>
                  <div>
                    <span className="meta-label">{t('flow.revision')}</span>
                    <strong>{draft.revision}</strong>
                  </div>
                  <div>
                    <span className="meta-label">{t('flow.updated')}</span>
                    <strong>{new Date(draft.updatedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="meta-label">{t('flow.editor')}</span>
                    <strong>{draft.updatedBy ?? '-'}</strong>
                  </div>
                </div>

                <div className="toolbar-row">
                  <button className="secondary-button" type="button" onClick={() => void runPreflight()}>
                    <CheckCircle2 size={16} />
                    <span>{busy === 'preflight' ? t('flow.checking') : t('flow.preflight')}</span>
                  </button>
                  <button className="primary-button" type="button" onClick={() => void runPublish()}>
                    <Rocket size={16} />
                    <span>{busy === 'publish' ? t('flow.publishing') : t('flow.publish')}</span>
                  </button>
                  <Link className="secondary-button link-button" to={`/flows/${draft.code}/editor`}>
                    <ExternalLink size={16} />
                    <span>{t('flow.openEditor')}</span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty-panel">{t('flow.unableToLoadDraft')}</div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>{t('flow.versionHistory')}</h3>
              <span>{t('flow.versionCount', { count: versions.length })}</span>
            </div>
            <div className="version-list">
              {versions.map((version) => (
                <div key={version.id} className="version-row">
                  <div>
                    <strong>v{version.versionNumber}</strong>
                    <p>{version.runtimeFlowId}</p>
                  </div>
                  <div className="version-actions">
                    {version.isActive ? <span className="status-pill success">{t('flow.active')}</span> : null}
                    {!version.isActive ? (
                      <button className="inline-button" type="button" onClick={() => void activateVersion(version.versionNumber)}>
                        {busy === `activate-${version.versionNumber}` ? t('flow.activating') : t('flow.activate')}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {versions.length === 0 ? <div className="empty-panel">{t('flow.emptyVersions')}</div> : null}
            </div>
          </div>
        </section>
      </div>

      {createOpen ? (
        <div className="modal-scrim" role="presentation">
          <form
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={t('flow.newFlow')}
            onSubmit={(event) => {
              event.preventDefault()
              void createFlow()
            }}
          >
            <div className="panel-header">
              <h3>{t('flow.newFlow')}</h3>
              <button type="button" className="icon-button" aria-label={t('common.close')} onClick={() => setCreateOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body form-grid">
              <label>
                <span>{t('flow.code')}</span>
                <input
                  value={createInput.code}
                  onChange={(event) => setCreateInput((current) => ({ ...current, code: event.target.value }))}
                />
              </label>
              <label>
                <span>{t('flow.name')}</span>
                <input
                  value={createInput.name}
                  onChange={(event) => setCreateInput((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>{t('flow.description')}</span>
                <textarea
                  value={createInput.description}
                  onChange={(event) => setCreateInput((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>
                {t('actions.cancel')}
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={busy === 'create' || !createInput.code.trim() || !createInput.name.trim()}
              >
                {busy === 'create' ? t('flow.creating') : t('actions.create')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
