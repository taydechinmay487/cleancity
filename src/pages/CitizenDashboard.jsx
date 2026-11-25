import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Plus, RefreshCw, Truck, X } from 'lucide-react'
import ComplaintCard from '../components/ComplaintCard.jsx'
import StatusStepper from '../components/StatusStepper.jsx'
import BeforeAfter from '../components/BeforeAfter.jsx'
import MapView from '../components/MapView.jsx'
import { PriorityChip, StatusChip } from '../components/StatusBadge.jsx'
import { getComplaint, listMyComplaints } from '../lib/data.js'
import { debounce, subscribe } from '../lib/realtime.js'
import { useAuth } from '../lib/auth.jsx'
import { categoryLabel, formatDateTime, timeAgo } from '../lib/format.js'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
]

export default function CitizenDashboard() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    try {
      const data = await listMyComplaints()
      setComplaints(data)
      return data
    } catch {
      return []
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const openById = async (id) => {
    try {
      const complaint = await getComplaint(id)
      setDetail(complaint)
      setParams({ code: complaint.code })
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load().then((list) => {
      const code = params.get('code')
      if (code) {
        const match = list.find((c) => c.code.toUpperCase() === code.toUpperCase())
        if (match) openById(match.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const refresh = debounce(async () => {
      const list = await listMyComplaints()
      setComplaints(list)
      setDetail((current) => (current ? list.find((c) => c.id === current.id) || current : current))
    }, 500)
    const unsubscribe = subscribe('complaints', {
      filter: `user_id=eq.${user.id}`,
      onChange: refresh,
    })
    return () => {
      refresh.cancel()
      unsubscribe()
    }
  }, [user?.id])

  const stats = useMemo(() => {
    const open = complaints.filter((c) => c.status !== 'resolved').length
    const done = complaints.filter((c) => c.status === 'resolved').length
    const active = complaints.filter((c) => ['assigned', 'in_progress'].includes(c.status)).length
    return { total: complaints.length, open, done, active }
  }, [complaints])

  const visible = useMemo(() => {
    if (filter === 'all') return complaints
    if (filter === 'open') return complaints.filter((c) => c.status !== 'resolved')
    return complaints.filter((c) => c.status === filter)
  }, [complaints, filter])

  const closeDetail = () => {
    setDetail(null)
    setParams({})
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">Citizen dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Every complaint you filed, with its live status. Updates arrive without refreshing.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true)
              load({ quiet: true })
            }}
            className="btn-outline btn-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link to="/report" className="btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> New report
          </Link>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total filed', value: stats.total, icon: Clock },
          { label: 'Open', value: stats.open, icon: Clock },
          { label: 'Being cleaned', value: stats.active, icon: Truck },
          { label: 'Resolved', value: stats.done, icon: CheckCircle2 },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <item.icon className="h-4 w-4 text-brand-600" />
            <p className="stat-value mt-2">{loading ? '—' : item.value}</p>
            <p className="stat-label mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`chip border transition ${
              filter === item.value
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
            }`}
          >
            {item.label}
            <span className={`text-[10px] ${filter === item.value ? 'text-white/70' : 'text-slate-400'}`}>
              {item.value === 'all'
                ? complaints.length
                : item.value === 'open'
                  ? stats.open
                  : complaints.filter((c) => c.status === item.value).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 w-full" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <Plus className="h-6 w-6" />
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              {complaints.length === 0 ? 'No complaints yet' : 'Nothing in this filter'}
            </h2>
            <p className="max-w-sm text-sm text-slate-600">
              {complaints.length === 0
                ? 'When you spot garbage on the street, report it with a photo and a pin. You will see every update here.'
                : 'Try another filter to see the rest of your complaints.'}
            </p>
            {complaints.length === 0 ? (
              <Link to="/report" className="btn-primary btn-sm mt-1">Report garbage</Link>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((complaint) => (
              <ComplaintCard
                key={complaint.id}
                complaint={complaint}
                onSelect={() => openById(complaint.id)}
              />
            ))}
          </div>
        )}
      </div>

      {detail ? (
        <div className="fixed inset-0 z-[1050] flex justify-end bg-slate-900/30 backdrop-blur-sm">
          <button type="button" className="flex-1" aria-label="Close details" onClick={closeDetail} />
          <aside className="animate-fade-up h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="font-mono text-xs tracking-wider text-slate-400">{detail.code}</p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">{categoryLabel(detail.category)}</h2>
                <div className="mt-1.5 flex gap-1.5">
                  <StatusChip status={detail.status} />
                  <PriorityChip priority={detail.priority} />
                </div>
              </div>
              <button type="button" onClick={closeDetail} className="btn-ghost btn-sm" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <StatusStepper status={detail.status} />

              {detail.photos?.length ? (
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Photos</h3>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {detail.photos.map((photo) => (
                      <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl border border-slate-200">
                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <BeforeAfter
                before={detail.photos?.find((p) => p.kind === 'before')?.url || detail.photos?.find((p) => p.kind === 'report')?.url}
                after={detail.photos?.find((p) => p.kind === 'after')?.url}
              />

              <div className="card overflow-hidden">
                <MapView pins={[detail]} center={[detail.lat, detail.lng]} zoom={15} height={180} className="rounded-none border-0" />
                <div className="px-4 py-3 text-xs text-slate-600">
                  <p className="font-medium text-slate-800">{detail.address}</p>
                  {detail.landmark ? <p className="text-slate-500">Landmark: {detail.landmark}</p> : null}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Description</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{detail.description}</p>
              </div>

              {detail.resolution ? (
                <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5">
                  <p className="text-[10px] font-semibold tracking-wide text-brand-700 uppercase">Resolution</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-900">{detail.resolution}</p>
                </div>
              ) : null}

              <div className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Reported</span>
                  <span className="text-right text-slate-800">{formatDateTime(detail.createdAt)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Crew</span>
                  <span className="text-right text-slate-800">
                    {detail.assignedTo || 'Not assigned yet'}
                    {detail.department ? ` · ${detail.department}` : ''}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Last update</span>
                  <span className="text-right text-slate-800">{timeAgo(detail.updatedAt)}</span>
                </div>
              </div>

              {detail.history?.length ? (
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">History</h3>
                  <ol className="mt-2 space-y-3">
                    {detail.history.map((entry) => (
                      <li key={entry.id} className="flex gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                        <div>
                          <p className="text-xs font-medium text-slate-700">{entry.note}</p>
                          <p className="text-[10px] text-slate-400">
                            {entry.actor_name} · {formatDateTime(entry.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div className="flex gap-2 pb-4">
                <Link to={`/track?code=${detail.code}`} className="btn-outline btn-sm flex-1">
                  Public tracking view
                </Link>
                <Link to="/report" className="btn-primary btn-sm flex-1">
                  Report another spot
                </Link>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
