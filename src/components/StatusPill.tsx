import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/useI18n'

const ORDER_STATUS_MAP: Record<number, { labelKey: MessageKey; tone: string }> = {
  0: { labelKey: 'status.orderDraft', tone: 'neutral' },
  1: { labelKey: 'status.orderSubmitted', tone: 'info' },
  2: { labelKey: 'status.running', tone: 'running' },
  3: { labelKey: 'status.completed', tone: 'success' },
  4: { labelKey: 'status.canceled', tone: 'muted' },
  5: { labelKey: 'status.failed', tone: 'danger' },
}

const FLOW_TASK_STATUS_MAP: Record<number, { labelKey: MessageKey; tone: string }> = {
  0: { labelKey: 'status.taskCreated', tone: 'neutral' },
  1: { labelKey: 'status.taskScheduled', tone: 'info' },
  2: { labelKey: 'status.taskStarting', tone: 'info' },
  3: { labelKey: 'status.running', tone: 'running' },
  4: { labelKey: 'status.completed', tone: 'success' },
  5: { labelKey: 'status.taskFailing', tone: 'danger' },
  6: { labelKey: 'status.failed', tone: 'danger' },
  7: { labelKey: 'status.taskCanceling', tone: 'muted' },
  8: { labelKey: 'status.canceled', tone: 'muted' },
}

export function StatusPill({ status }: { status: number }) {
  const { t } = useI18n()
  const item = ORDER_STATUS_MAP[status]
  const label = item ? t(item.labelKey) : t('status.unknownStatus', { status })
  return <span className={`status-pill ${item?.tone ?? 'neutral'}`}>{label}</span>
}

export function FlowTaskStatusPill({ status }: { status: number }) {
  const { t } = useI18n()
  const item = FLOW_TASK_STATUS_MAP[status]
  const label = item ? t(item.labelKey) : t('status.unknownTask', { status })
  return <span className={`status-pill ${item?.tone ?? 'neutral'}`}>{label}</span>
}
