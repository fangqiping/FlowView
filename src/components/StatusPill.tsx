const ORDER_STATUS_MAP: Record<number, { label: string; tone: string }> = {
  0: { label: 'Draft', tone: 'neutral' },
  1: { label: 'Submitted', tone: 'info' },
  2: { label: 'Running', tone: 'running' },
  3: { label: 'Completed', tone: 'success' },
  4: { label: 'Canceled', tone: 'muted' },
  5: { label: 'Failed', tone: 'danger' },
}

const FLOW_TASK_STATUS_MAP: Record<number, { label: string; tone: string }> = {
  0: { label: 'Created', tone: 'neutral' },
  1: { label: 'Scheduled', tone: 'info' },
  2: { label: 'Starting', tone: 'info' },
  3: { label: 'Running', tone: 'running' },
  4: { label: 'Completed', tone: 'success' },
  5: { label: 'Failing', tone: 'danger' },
  6: { label: 'Failed', tone: 'danger' },
  7: { label: 'Canceling', tone: 'muted' },
  8: { label: 'Canceled', tone: 'muted' },
}

export function StatusPill({ status }: { status: number }) {
  const item = ORDER_STATUS_MAP[status] ?? { label: `Status ${status}`, tone: 'neutral' }
  return <span className={`status-pill ${item.tone}`}>{item.label}</span>
}

export function FlowTaskStatusPill({ status }: { status: number }) {
  const item = FLOW_TASK_STATUS_MAP[status] ?? { label: `Task ${status}`, tone: 'neutral' }
  return <span className={`status-pill ${item.tone}`}>{item.label}</span>
}
