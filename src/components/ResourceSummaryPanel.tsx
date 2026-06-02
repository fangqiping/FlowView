import type { ResourceSummaryCard } from '../types'
import { useI18n } from '../i18n/useI18n'

export function ResourceSummaryPanel({ summary }: { summary: ResourceSummaryCard }) {
  const { t } = useI18n()

  return (
    <div className="line-list resource-summary-panel">
      <h4>{summary.title}</h4>
      {summary.ruleMatch ? (
        <div className="inline-note">{t('resource.ruleMatch')}: <strong>{summary.ruleMatch}</strong></div>
      ) : null}
      {summary.transition?.before || summary.transition?.after ? (
        <div className="meta-grid compact resource-transition-grid">
          {summary.transition.before ? (
            <div>
              <span className="meta-label">{t('resource.before')}</span>
              <strong>{summary.transition.before}</strong>
            </div>
          ) : null}
          {summary.transition.after ? (
            <div>
              <span className="meta-label">{t('resource.after')}</span>
              <strong>{summary.transition.after}</strong>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="meta-grid compact">
        {summary.fields.map((field) => (
          <div key={field.label}>
            <span className="meta-label">{field.label}</span>
            <strong>{field.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
