import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, MapPin, Search, User } from 'lucide-react'
import StatusStepper from '../components/StatusStepper.jsx'
import BeforeAfter from '../components/BeforeAfter.jsx'
import MapView from '../components/MapView.jsx'
import { PriorityChip, StatusChip } from '../components/StatusBadge.jsx'
import { trackComplaint } from '../lib/data.js'
import { debounce, subscribe } from '../lib/realtime.js'
import { categoryLabel, formatDateTime, timeAgo } from '../lib/format.js'

export default function Track() {
  const [params, setParams] = useSearchParams()
  const [code, setCode] = useState(params.get('code') || '')
  const [complaint, setComplaint] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)


  const lookup = useCallback(async (value) => {
    const clean = value.trim().toUpperCase()
    if (!clean) return
    setLoading(true)
    setError('')
    try {
      const next = await trackComplaint(clean)
      if (!next) {
        setComplaint(null)
        setError('No complaint found with that ID.')
        return
      }
      setComplaint(next)
    } catch (err) {
      setComplaint(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initial = params.get('code')
    if (initial) lookup(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!complaint?.code) return
    const code = complaint.code
    const refresh = debounce(() => {
      trackComplaint(code)
        .then((next) => next && setComplaint(next))
        .catch(() => {})
    }, 500)
    const unsubscribe = subscribe('complaint_feed', {
      filter: `code=eq.${code}`,
      onChange: refresh,
    })
    return () => {
      refresh.cancel()
      unsubscribe()
    }
  }, [complaint?.code])

  const submit = (event) => {
    event.preventDefault()
    setParams(code.trim() ? { code: code.trim().toUpperCase() } : {})
    lookup(code)
  }

  const before = complaint?.photos?.find((p) => p.kind === 'before') || complaint?.photos?.find((p) => p.kind === 'report')
  const after = complaint?.photos?.find((p) => p.kind === 'after')
  const gallery = complaint?.photos?.filter((p) => p.kind === 'report' || p.kind === 'before') || []

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">Track complaint</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Where is my complaint?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the complaint ID you received after submitting, for example <span className="font-mono">CC-7K3M9Q</span>.
        </p>

        <form onSubmit={submit} className="mx-auto mt-6 flex max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 font-mono uppercase"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="CC-XXXXXX"
              aria-label="Complaint ID"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Track'}
          </button>
        </form>
      </div>

      {error ? (
        <div className="mx-auto mt-8 max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {complaint ? (
        <div className="animate-fade-up mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs tracking-wider text-slate-400">{complaint.code}</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{categoryLabel(complaint.category)}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {complaint.address}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusChip status={complaint.status} />
                  <PriorityChip priority={complaint.priority} />
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <StatusStepper status={complaint.status} />
              </div>

              {complaint.resolution ? (
                <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/70 p-3.5">
                  <p className="text-[10px] font-semibold tracking-wide text-brand-700 uppercase">Resolution details</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-900">{complaint.resolution}</p>
                </div>
              ) : null}
            </div>

            {gallery.length || after ? (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900">Before and after</h3>
                <div className="mt-3">
                  <BeforeAfter before={before?.url} after={after?.url} />
                </div>

                {gallery.length > 1 ? (
                  <>
                    <h4 className="mt-5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      All site photos
                    </h4>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {gallery.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="aspect-square overflow-hidden rounded-xl border border-slate-200"
                        >
                          <img src={photo.url} alt="Reported site" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900">History</h3>
              <ol className="mt-4 space-y-4">
                {complaint.history.map((entry) => (
                  <li key={entry.id} className="relative flex gap-3 pl-1">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800">
                        {entry.note || entry.status.replace('_', ' ')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {entry.actor_name} · {formatDateTime(entry.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
                {complaint.history.length === 0 ? (
                  <li className="text-xs text-slate-500">No history recorded yet.</li>
                ) : null}
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card overflow-hidden">
              <MapView
                pins={[{ ...complaint, id: complaint.id }]}
                center={[complaint.lat, complaint.lng]}
                zoom={15}
                height={240}
                selectedId={complaint.id}
                className="rounded-none border-0"
              />
              <div className="px-4 py-3 text-xs text-slate-500">
                <p className="font-medium text-slate-700">{complaint.address}</p>
                {complaint.landmark ? <p className="mt-0.5">Landmark: {complaint.landmark}</p> : null}
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  {complaint.lat.toFixed(5)}, {complaint.lng.toFixed(5)}
                </p>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900">Complaint details</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Reported</dt>
                  <dd className="text-slate-700">{formatDateTime(complaint.createdAt)} · {timeAgo(complaint.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Description</dt>
                  <dd className="leading-relaxed text-slate-700">{complaint.description}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Reported by</dt>
                  <dd className="flex items-center gap-1.5 text-slate-700">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {complaint.reporterName}
                  </dd>
                </div>
                {complaint.assignedTo ? (
                  <div>
                    <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Assigned to</dt>
                    <dd className="text-slate-700">
                      {complaint.assignedTo}
                      {complaint.department ? ` · ${complaint.department}` : ''}
                    </dd>
                  </div>
                ) : null}
                {complaint.resolvedAt ? (
                  <div>
                    <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Resolved</dt>
                    <dd className="text-brand-700">{formatDateTime(complaint.resolvedAt)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              Something wrong? Call the municipal control room and quote{' '}
              <span className="font-mono font-semibold text-slate-700">{complaint.code}</span>.{' '}
              <Link to="/report" className="font-semibold text-brand-700 hover:underline">
                Report a new spot
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
