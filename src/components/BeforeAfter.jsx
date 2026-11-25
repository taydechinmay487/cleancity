import { ImageOff } from 'lucide-react'

export default function BeforeAfter({ before, after }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Panel title="Before" tone="before" photo={before} />
      <Panel title="After" tone="after" photo={after} />
    </div>
  )
}

function Panel({ title, tone, photo }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div
        className={`flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${
          tone === 'after' ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-500'
        }`}
      >
        {title}
        <span className="font-normal normal-case tracking-normal text-slate-400">
          {photo ? 'Cleaning record' : 'Not uploaded'}
        </span>
      </div>
      {photo ? (
        <img src={photo} alt={`${title} cleaning`} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-300">
          <ImageOff className="h-6 w-6" />
          <span className="text-xs text-slate-400">Awaiting photo</span>
        </div>
      )}
    </div>
  )
}
