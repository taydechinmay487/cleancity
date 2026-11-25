import { Link } from 'react-router-dom'
import { MapPin, ImageIcon, ArrowUpRight } from 'lucide-react'
import { PriorityChip, StatusChip } from './StatusBadge.jsx'
import { categoryLabel, timeAgo } from '../lib/format.js'

export default function ComplaintCard({ complaint, to, onSelect, compact = false }) {
  const photo = complaint.photos?.find((p) => p.kind === 'report') || complaint.photos?.[0]
  const Wrapper = to ? Link : 'button'
  const wrapperProps = to
    ? { to }
    : { type: 'button', onClick: () => onSelect?.(complaint) }

  return (
    <Wrapper
      {...wrapperProps}
      className={`card group flex w-full gap-3 p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md ${
        compact ? 'items-center' : 'items-start'
      }`}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {photo ? (
          <img src={photo.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full place-items-center text-slate-300">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        {complaint.photos?.length > 1 ? (
          <span className="absolute right-1 bottom-1 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            +{complaint.photos.length - 1}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{categoryLabel(complaint.category)}</p>
            <p className="mt-0.5 font-mono text-[11px] tracking-wide text-slate-400">{complaint.code}</p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-600" />
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{complaint.description}</p>

        <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{complaint.address}</span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusChip status={complaint.status} />
          <PriorityChip priority={complaint.priority} />
          <span className="ml-auto text-[11px] text-slate-400">{timeAgo(complaint.createdAt)}</span>
        </div>
      </div>
    </Wrapper>
  )
}
