import type { ReadinessStatus } from '../types'

const LABEL: Record<ReadinessStatus, string> = {
  growing: '生育中',
  approaching: 'もうすぐ適期',
  ready: '収穫適期',
  overdue: '適期超過',
}

const CLASS: Record<ReadinessStatus, string> = {
  growing: 'badge badge-growing',
  approaching: 'badge badge-approaching',
  ready: 'badge badge-ready',
  overdue: 'badge badge-overdue',
}

export function StatusBadge({ status }: { status: ReadinessStatus }) {
  return <span className={CLASS[status]}>{LABEL[status]}</span>
}
