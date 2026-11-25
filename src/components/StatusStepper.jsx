import { Check } from 'lucide-react'
import { STATUS_ORDER, STATUS_META, statusIndex } from '../lib/format.js'

export default function StatusStepper({ status }) {
  const current = statusIndex(status)
  return (
    <ol className="flex flex-wrap gap-y-3 sm:flex-nowrap">
      {STATUS_ORDER.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-2 pr-2">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition ${
                done
                  ? 'bg-brand-600 text-white'
                  : active
                    ? 'bg-brand-100 text-brand-800 ring-2 ring-brand-500'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span
              className={`min-w-0 truncate text-xs font-medium ${
                active ? 'text-slate-900' : done ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              {STATUS_META[step].label}
            </span>
            {index < STATUS_ORDER.length - 1 ? (
              <span className={`hidden h-px flex-1 sm:block ${done ? 'bg-brand-400' : 'bg-slate-200'}`} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
