import type { ResourceSummaryCard } from '../types'

export function ResourceSummaryPanel({ summary }: { summary: ResourceSummaryCard }) {
  return (
    <div className="line-list resource-summary-panel">
      <h4>{summary.title}</h4>
      {summary.ruleMatch ? (
        <div className="inline-note">Rule match: <strong>{summary.ruleMatch}</strong></div>
      ) : null}
      {summary.transition?.before || summary.transition?.after ? (
        <div className="meta-grid compact resource-transition-grid">
          {summary.transition.before ? (
            <div>
              <span className="meta-label">Before</span>
              <strong>{summary.transition.before}</strong>
            </div>
          ) : null}
          {summary.transition.after ? (
            <div>
              <span className="meta-label">After</span>
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
