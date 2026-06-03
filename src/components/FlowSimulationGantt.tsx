import type { CSSProperties } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { FlowSimulationModel, FlowSimulationNodeModel } from '../types'

interface FlowSimulationGanttProps {
  simulation: FlowSimulationModel
}

export function FlowSimulationGantt({ simulation }: FlowSimulationGanttProps) {
  const { t } = useI18n()
  const totalDuration = Math.max(0, simulation.totalDurationMilliseconds)
  const rows = simulation.nodes
    .slice()
    .sort((left, right) =>
      left.earliestStartMilliseconds - right.earliestStartMilliseconds
      || left.earliestEndMilliseconds - right.earliestEndMilliseconds
      || left.nodeId.localeCompare(right.nodeId),
    )

  return (
    <section className="panel simulation-panel" aria-label={t('flow.simulationGantt')}>
      <div className="panel-header">
        <h3>{t('flow.simulationGantt')}</h3>
        <span>{t('flow.totalDuration', { duration: formatDuration(totalDuration) })}</span>
      </div>
      {rows.length > 0 ? (
        <div className="simulation-gantt" role="list">
          {rows.map((node) => (
            <SimulationRow
              key={node.nodeId}
              node={node}
              totalDuration={totalDuration}
            />
          ))}
        </div>
      ) : (
        <div className="empty-panel compact">{t('flow.noSimulationNodes')}</div>
      )}
    </section>
  )
}

function SimulationRow({ node, totalDuration }: { node: FlowSimulationNodeModel, totalDuration: number }) {
  const { t } = useI18n()
  const start = Math.max(0, node.earliestStartMilliseconds)
  const duration = Math.max(0, node.estimatedDurationMilliseconds)
  const left = totalDuration > 0 ? (start / totalDuration) * 100 : 0
  const width = totalDuration > 0 ? (duration / totalDuration) * 100 : 0
  const barStyle = {
    left: `${Math.min(left, 100)}%`,
    width: `${Math.max(duration > 0 ? width : 0.75, duration > 0 ? 2 : 0.75)}%`,
  } satisfies CSSProperties

  return (
    <div className="simulation-row" role="listitem">
      <div className="simulation-row-label">
        <strong>{node.nodeId}</strong>
        <span>{formatDuration(start)} - {formatDuration(node.earliestEndMilliseconds)}</span>
      </div>
      <div
        className="simulation-track"
        aria-label={`${node.nodeId} ${formatDuration(duration)}`}
        title={`${node.nodeId}: ${formatDuration(duration)}`}
      >
        <div className={node.isCriticalPath ? 'simulation-bar critical' : 'simulation-bar'} style={barStyle}>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="simulation-row-meta">
        <span>{node.nodeType}</span>
        {node.isCriticalPath ? <strong>{t('flow.criticalPath')}</strong> : null}
      </div>
    </div>
  )
}

function formatDuration(milliseconds: number) {
  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(1)}s`
  }

  return `${milliseconds}ms`
}
