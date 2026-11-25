import { PRIORITY_META, STATUS_META } from '../lib/format.js'

export function StatusChip({ status, className = '' }) {
  const meta = STATUS_META[status] || STATUS_META.new
  return (
    <span className={`chip ${meta.chip} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

export function PriorityChip({ priority, className = '' }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium
  return <span className={`chip ${meta.chip} ${className}`}>{meta.label} priority</span>
}
