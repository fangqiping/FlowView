import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCcw, Rocket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { api, ApiError, extractDesignError } from '../lib/api'
import { buildCatalogSummary } from '../lib/flowCatalogSummary'
import type { FlowCatalogModel, FlowDraftModel, FlowVersionModel } from '../types'

const DEMO_FLOW_CODES = ['inbound-basic', 'outbound-basic']

export function FlowDefinitionsPage() {
  const [selectedCode, setSelectedCode] = useState(DEMO_FLOW_CODES[0])
  const [draft, setDraft] = useState<FlowDraftModel | null>(null)
  const [versions, setVersions] = useState<FlowVersionModel[]>([])
  const [catalog, setCatalog] = useState<FlowCatalogModel | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const catalogSummary = catalog ? buildCatalogSummary(catalog) : null

  useEffect(() => {
    void loadCatalog()
  }, [])

  useEffect(() => {
    void loadDefinition(selectedCode)
  }, [selectedCode])

  async function loadCatalog() {
    try {
      setCatalog(await api.getFlowCatalog())
    } catch {
      // Keep page usable even if catalog is unavailable.
    }
  }

  async function loadDefinition(code: string) {
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
        eyebrow="Design Runtime"
        title="Flow Definitions"
        actions={
          <button className="icon-button" type="button" onClick={() => void loadDefinition(selectedCode)}>
            <RefreshCcw size={16} />
          </button>
        }
      />

      {message ? <div className="banner success">{message}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}

      <div className="workspace-grid flow-definitions-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>Definition list</h3>
            <span>Demo flows</span>
          </div>
          <div className="stack-list">
            {DEMO_FLOW_CODES.map((code) => (
              <button
                key={code}
                type="button"
                className={`list-item-button${selectedCode === code ? ' selected' : ''}`}
                onClick={() => setSelectedCode(code)}
              >
                <div>
                  <strong>{code}</strong>
                  <p>{code === 'inbound-basic' ? 'Inbound put-away flow' : 'Outbound retrieval flow'}</p>
                </div>
                {versions.some((item) => item.isActive && item.code === code) ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
              </button>
            ))}
          </div>

          {catalogSummary ? (
            <div className="catalog-summary">
              <h4>Catalog summary</h4>
              <div className="meta-grid compact">
                <div><span className="meta-label">Operations</span><strong>{catalogSummary.operations}</strong></div>
                <div><span className="meta-label">Subflows</span><strong>{catalogSummary.subflows}</strong></div>
                <div><span className="meta-label">Variable types</span><strong>{catalogSummary.variableTypes}</strong></div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="detail-column">
          <div className="panel">
            <div className="panel-header">
              <h3>Draft</h3>
              <span>{busy === 'loading' ? 'Loading…' : draft?.code ?? selectedCode}</span>
            </div>

            {draft ? (
              <>
                <div className="meta-grid">
                  <div>
                    <span className="meta-label">Name</span>
                    <strong>{draft.name}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Revision</span>
                    <strong>{draft.revision}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Updated</span>
                    <strong>{new Date(draft.updatedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Editor</span>
                    <strong>{draft.updatedBy ?? '-'}</strong>
                  </div>
                </div>

                <div className="toolbar-row">
                  <button className="secondary-button" type="button" onClick={() => void runPreflight()}>
                    <CheckCircle2 size={16} />
                    <span>{busy === 'preflight' ? 'Checking…' : 'Preflight'}</span>
                  </button>
                  <button className="primary-button" type="button" onClick={() => void runPublish()}>
                    <Rocket size={16} />
                    <span>{busy === 'publish' ? 'Publishing…' : 'Publish'}</span>
                  </button>
                  <Link className="secondary-button link-button" to={`/flows/${draft.code}/editor`}>
                    <ExternalLink size={16} />
                    <span>Open editor</span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty-panel">Unable to load draft for this code yet.</div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Version history</h3>
              <span>{versions.length} versions</span>
            </div>
            <div className="version-list">
              {versions.map((version) => (
                <div key={version.id} className="version-row">
                  <div>
                    <strong>v{version.versionNumber}</strong>
                    <p>{version.runtimeFlowId}</p>
                  </div>
                  <div className="version-actions">
                    {version.isActive ? <span className="status-pill success">Active</span> : null}
                    {!version.isActive ? (
                      <button className="inline-button" type="button" onClick={() => void activateVersion(version.versionNumber)}>
                        {busy === `activate-${version.versionNumber}` ? 'Activating…' : 'Activate'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {versions.length === 0 ? <div className="empty-panel">No published versions yet.</div> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
