import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FlowSimulationGantt } from '../components/FlowSimulationGantt'
import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../i18n/useI18n'
import { api } from '../lib/api'
import { loadFlowSimulation } from '../lib/flowSimulationCache'
import type { FlowSimulationModel } from '../types'

export function FlowSimulationPage() {
  const { t } = useI18n()
  const { code = '' } = useParams()
  const [searchParams] = useSearchParams()
  const versionNumber = Number(searchParams.get('version') ?? '')
  const [simulation, setSimulation] = useState<FlowSimulationModel | null>(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadSimulation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, versionNumber])

  async function loadSimulation() {
    if (!code) {
      return
    }

    try {
      setBusy(true)
      setError(null)
      if (Number.isFinite(versionNumber) && versionNumber > 0) {
        const versions = await api.getFlowVersions(code)
        const version = versions.find((item) => item.versionNumber === versionNumber)
        setSimulation(version?.simulation ?? null)
        setSourceLabel(t('flow.simulationSourceVersion', { version: versionNumber }))
        return
      }

      setSimulation(loadFlowSimulation(code))
      setSourceLabel(t('flow.simulationSourcePreflight'))
    } catch (caught) {
      setSimulation(null)
      setError(caught instanceof Error ? caught.message : 'Failed to load flow simulation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('flow.simulationGantt')}
        title={t('flow.simulationTitle', { code })}
        actions={
          <Link className="secondary-button link-button" to={`/flows/${code}/editor`}>
            <ArrowLeft size={16} />
            <span>{t('flow.backToEditor')}</span>
          </Link>
        }
      />

      {error ? <div className="banner error">{error}</div> : null}

      <div className="simulation-source-bar">
        <span>{t('flow.simulationSource')}</span>
        <strong>{busy ? t('common.loading') : sourceLabel}</strong>
      </div>

      {simulation ? (
        <FlowSimulationGantt simulation={simulation} />
      ) : (
        <div className="empty-panel">{busy ? t('common.loading') : t('flow.simulationUnavailable')}</div>
      )}
    </div>
  )
}
