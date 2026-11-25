export const STATUS_META = {
  new: { label: 'New complaint', chip: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  acknowledged: { label: 'Acknowledged', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  assigned: { label: 'Assigned', chip: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  in_progress: { label: 'Cleaning in progress', chip: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500' },
  resolved: { label: 'Resolved', chip: 'bg-brand-100 text-brand-800', dot: 'bg-brand-600' },
}

export const STATUS_ORDER = ['new', 'acknowledged', 'assigned', 'in_progress', 'resolved']

export const PRIORITY_META = {
  low: { label: 'Low', chip: 'bg-slate-100 text-slate-600', ring: 'ring-slate-200' },
  medium: { label: 'Medium', chip: 'bg-sky-100 text-sky-700', ring: 'ring-sky-200' },
  high: { label: 'High', chip: 'bg-orange-100 text-orange-700', ring: 'ring-orange-200' },
  urgent: { label: 'Urgent', chip: 'bg-red-100 text-red-700', ring: 'ring-red-200' },
}

export const CATEGORY_LABELS = {
  household: 'Household waste',
  plastic: 'Plastic waste',
  construction: 'Construction debris',
  ewaste: 'E-waste',
  medical: 'Medical waste',
  sewage: 'Sewage / liquid waste',
  deadanimal: 'Dead animal',
  organic: 'Garden / organic waste',
  other: 'Other',
}

export const categoryLabel = (value) => CATEGORY_LABELS[value] || value

/** SQLite stores UTC as "YYYY-MM-DD HH:MM:SS". */
export function parseServerDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const normalised = String(value).includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalised)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value) {
  const date = parseServerDate(value)
  if (!date) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value) {
  const date = parseServerDate(value)
  if (!date) return '—'
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function timeAgo(value) {
  const date = parseServerDate(value)
  if (!date) return '—'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d ago`
  return formatDate(value)
}

export function statusLabel(value) {
  return STATUS_META[value]?.label || value
}

export function statusIndex(value) {
  const idx = STATUS_ORDER.indexOf(value)
  return idx < 0 ? 0 : idx
}
