import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  Filter,
  ImageIcon,
  Loader2,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  Users,
  X,
} from 'lucide-react'
import ComplaintDrawer from '../components/ComplaintDrawer.jsx'
import MapView from '../components/MapView.jsx'
import { PriorityChip, StatusChip } from '../components/StatusBadge.jsx'
import {
  downloadReportCsv,
  fetchAdminMap,
  fetchAdminStats,
  fetchMonthlyReport,
  fetchWorkers,
  getComplaint,
  listComplaints,
  updateComplaint,
  uploadComplaintPhotos,
} from '../lib/data.js'
import { debounce, subscribe } from '../lib/realtime.js'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../lib/toast.jsx'
import {
  CATEGORY_LABELS,
  PRIORITY_META,
  STATUS_META,
  STATUS_ORDER,
  categoryLabel,
  formatDateTime,
  timeAgo,
} from '../lib/format.js'

const EMPTY_FILTERS = { q: '', status: '', category: '', priority: '', from: '', to: '' }

export default function AuthorityDashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [stats, setStats] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('complaints')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [detail, setDetail] = useState(null)
  const [pins, setPins] = useState([])
  const [workers, setWorkers] = useState({ workers: [], departments: [] })
  const [report, setReport] = useState(null)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [refreshing, setRefreshing] = useState(false)
  const openedFromLink = useRef(false)

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchAdminStats())
    } catch {
      /* ignore */
    }
  }, [])

  const loadComplaints = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const list = await listComplaints(filters)
      setComplaints(list)
      return list
    } catch {
      return []
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filters])

  const loadMap = useCallback(async () => {
    try {
      setPins(await fetchAdminMap())
    } catch {
      /* ignore */
    }
  }, [])

  const loadWorkers = useCallback(async () => {
    try {
      setWorkers(await fetchWorkers())
    } catch {
      /* ignore */
    }
  }, [])

  const loadReport = useCallback(async (value) => {
    setReport(null)
    try {
      setReport(await fetchMonthlyReport(value))
    } catch {
      /* ignore */
    }
  }, [])

  const openComplaint = useCallback(async (id) => {
    try {
      setDetail(await getComplaint(id))
    } catch (err) {
      toast.error('Could not open complaint', err.message)
    }
  }, [toast])

  useEffect(() => {
    loadStats()
    loadWorkers()
    loadComplaints().then((list) => {
      const code = params.get('complaint')
      if (code && !openedFromLink.current) {
        openedFromLink.current = true
        const match = list.find((c) => c.code.toUpperCase() === code.toUpperCase())
        if (match) openComplaint(match.id)
        else
          listComplaints({ q: code })
            .then((list) => list[0] && openComplaint(list[0].id))
            .catch(() => {})
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tab === 'complaints') loadComplaints()
      if (tab === 'map') loadMap()
    }, 280)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, tab])

  useEffect(() => {
    if (tab === 'reports') loadReport(month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, month])

  useEffect(() => {
    if (tab === 'map') loadMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    const refresh = debounce(async () => {
      const list = await listComplaints(filters).catch(() => null)
      if (list) {
        setComplaints(list)
        setDetail((current) => (current ? list.find((c) => c.id === current.id) || current : current))
      }
      loadStats()
      if (tab === 'map') loadMap()
    }, 500)

    const unsubscribe = subscribe('complaints', { onChange: refresh })

    return () => {
      refresh.cancel()
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, tab])

  useEffect(() => {
    const unsubscribe = subscribe('complaints', {
      event: 'INSERT',
      onChange: (payload) => {
        const row = payload?.new
        if (!row?.code) return
        toast.info(
          `New ${row.priority} complaint`,
          `${row.code} · ${categoryLabel(row.category)} at ${row.address}`,
        )
      },
    })
    return unsubscribe
  }, [toast])

  const saveComplaint = async (patch) => {
    if (!detail) return
    try {
      const updated = await updateComplaint(detail.id, patch)
      setDetail(updated)
      toast.success('Complaint updated', `${updated.code} is now ${STATUS_META[updated.status].label.toLowerCase()}.`)
      loadComplaints(true)
      loadStats()
    } catch (err) {
      toast.error('Update failed', err.message)
    }
  }

  const uploadPhotos = async (kind, files) => {
    if (!detail) return
    try {
      const updated = await uploadComplaintPhotos(detail.id, kind, files)
      setDetail(updated)
      toast.success(`${kind === 'after' ? 'After' : 'Before'} photo uploaded`, `${files.length} file(s) attached.`)
    } catch (err) {
      toast.error('Upload failed', err.message)
    }
  }

  const refreshAll = () => {
    setRefreshing(true)
    loadStats()
    loadComplaints(true)
    loadWorkers()
    if (tab === 'map') loadMap()
  }

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  )

  const statCards = [
    { key: 'total', label: 'Total complaints', value: stats?.total, icon: ClipboardList, tone: 'text-slate-700 bg-slate-100' },
    { key: 'pending', label: 'Pending action', value: stats?.pending, icon: AlertTriangle, tone: 'text-amber-700 bg-amber-100' },
    { key: 'processing', label: 'Being processed', value: stats?.processing, icon: Truck, tone: 'text-indigo-700 bg-indigo-100' },
    { key: 'resolved', label: 'Locations cleaned', value: stats?.resolved, icon: CheckCircle2, tone: 'text-brand-700 bg-brand-100' },
    { key: 'urgent', label: 'High priority open', value: stats?.highPriority, icon: MapPin, tone: 'text-red-700 bg-red-100' },
  ]

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">Authority dashboard</p>
          <h1 className="mt-1.5 text-2xl font-bold text-slate-900 sm:text-3xl">Municipal operations</h1>
          <p className="mt-1 text-sm text-slate-600">
            {user?.name} · {user?.department || user?.role} · updates arrive live
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refreshAll} className="btn-outline btn-sm">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => downloadReportCsv(month).catch(() => {})}
            className="btn-primary btn-sm"
          >
            <Download className="h-3.5 w-3.5" /> Monthly CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <div key={card.key} className="card p-4">
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${card.tone}`}>
              <card.icon className="h-4 w-4" />
            </span>
            <p className="stat-value mt-2.5">{card.value ?? '—'}</p>
            <p className="stat-label mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-7 flex flex-wrap items-center gap-1 border-b border-slate-200">
        {[
          { value: 'complaints', label: 'Complaints', icon: ClipboardList },
          { value: 'map', label: 'Map', icon: MapIcon },
          { value: 'reports', label: 'Monthly report', icon: BarChart3 },
          { value: 'teams', label: 'Crews & departments', icon: Users },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              tab === item.value
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab === 'complaints' ? (
        <div className="mt-4 card p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search ID, address, description, crew…"
                value={filters.q}
                onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              />
            </div>
            <select
              className="select w-auto min-w-40"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((value) => (
                <option key={value} value={value}>{STATUS_META[value].label}</option>
              ))}
            </select>
            <select
              className="select w-auto min-w-40"
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
            >
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              className="select w-auto min-w-32"
              value={filters.priority}
              onChange={(event) => setFilters({ ...filters, priority: event.target.value })}
            >
              <option value="">All priorities</option>
              {Object.entries(PRIORITY_META).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
            <input
              type="date"
              className="input w-auto"
              value={filters.from}
              onChange={(event) => setFilters({ ...filters, from: event.target.value })}
              aria-label="From date"
            />
            <input
              type="date"
              className="input w-auto"
              value={filters.to}
              onChange={(event) => setFilters({ ...filters, to: event.target.value })}
              aria-label="To date"
            />
            {activeFilterCount ? (
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="btn-ghost btn-sm">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                <Filter className="h-3.5 w-3.5" /> {complaints.length} shown
              </span>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'complaints' ? (
        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
            </div>
          ) : complaints.length === 0 ? (
            <div className="card px-6 py-16 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <ClipboardList className="h-6 w-6" />
              </span>
              <h2 className="mt-3 text-base font-semibold text-slate-900">No complaints match</h2>
              <p className="mt-1 text-sm text-slate-600">
                New citizen reports appear here the moment they are submitted.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="hidden w-full text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] tracking-wide text-slate-500 uppercase">
                    <th className="px-4 py-2.5 font-semibold">Complaint</th>
                    <th className="px-3 py-2.5 font-semibold">Location</th>
                    <th className="px-3 py-2.5 font-semibold">Priority</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Crew</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => {
                    const photo = complaint.photos.find((p) => p.kind === 'report') || complaint.photos[0]
                    return (
                      <tr
                        key={complaint.id}
                        onClick={() => openComplaint(complaint.id)}
                        className="cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-brand-50/40"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                              {photo ? (
                                <img src={photo.url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-slate-300">
                                  <ImageIcon className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-900">
                                {categoryLabel(complaint.category)}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">{complaint.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[16rem] px-3 py-2.5">
                          <p className="truncate text-xs text-slate-700">{complaint.address}</p>
                          <p className="truncate text-[10px] text-slate-400">{complaint.landmark || '—'}</p>
                        </td>
                        <td className="px-3 py-2.5"><PriorityChip priority={complaint.priority} /></td>
                        <td className="px-3 py-2.5"><StatusChip status={complaint.status} /></td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">{complaint.assignedTo || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-[11px] text-slate-400">{timeAgo(complaint.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="divide-y divide-slate-100 md:hidden">
                {complaints.map((complaint) => (
                  <button
                    key={complaint.id}
                    type="button"
                    onClick={() => openComplaint(complaint.id)}
                    className="flex w-full items-start gap-3 p-3 text-left active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900">{categoryLabel(complaint.category)}</p>
                      <p className="font-mono text-[10px] text-slate-400">{complaint.code}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-600">{complaint.address}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusChip status={complaint.status} />
                        <PriorityChip priority={complaint.priority} />
                      </div>
                    </div>
                    <span className="text-[10px] whitespace-nowrap text-slate-400">{timeAgo(complaint.createdAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'map' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <MapView pins={pins} height={520} zoom={11} onSelect={(pin) => openComplaint(pin.id)} />
          <div className="space-y-3">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-slate-900">Open complaints nearby</h3>
              <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {pins
                  .filter((p) => p.status !== 'resolved')
                  .slice(0, 40)
                  .map((pin) => (
                    <button
                      key={pin.id}
                      type="button"
                      onClick={() => openComplaint(pin.id)}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-slate-100 p-2 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {pin.thumbnail ? (
                          <img src={pin.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800">{pin.address}</p>
                        <p className="font-mono text-[10px] text-slate-400">{pin.code}</p>
                      </div>
                      <StatusChip status={pin.status} />
                    </button>
                  ))}
                {pins.filter((p) => p.status !== 'resolved').length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No open complaints. The city is clear.</p>
                ) : null}
              </div>
            </div>
            <p className="px-1 text-[11px] text-slate-500">
              Click any pin to open the full complaint, its photos and the cleaning controls.
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="mt-4 space-y-4">
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <label className="label mb-0" htmlFor="month">Report month</label>
            <input
              id="month"
              type="month"
              className="input w-auto"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
            <button
              type="button"
              onClick={() => downloadReportCsv(month).catch(() => {})}
              className="btn-outline btn-sm"
            >
              <Download className="h-3.5 w-3.5" /> Download CSV
            </button>
            <span className="text-xs text-slate-500">
              Generated from the complaint table — no manual counting.
            </span>
          </div>

          {!report ? (
            <div className="skeleton h-40 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Complaints received', value: report.total },
                  { label: 'Resolved', value: report.resolved },
                  { label: 'Resolution rate', value: `${report.resolutionRate}%` },
                  { label: 'Avg resolution', value: report.avgResolutionHours ? `${report.avgResolutionHours} h` : '—' },
                ].map((item) => (
                  <div key={item.label} className="card p-4">
                    <p className="stat-value">{item.value}</p>
                    <p className="stat-label mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-slate-900">By category</h3>
                  <div className="mt-3 space-y-2.5">
                    {report.byCategory.length === 0 ? (
                      <p className="text-xs text-slate-400">No complaints this month.</p>
                    ) : (
                      report.byCategory.map((item) => (
                        <div key={item.category}>
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>{item.label}</span>
                            <span className="font-semibold text-slate-800">{item.count}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${(item.count / report.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-slate-900">By status</h3>
                  <div className="mt-3 space-y-2">
                    {report.byStatus.map((item) => (
                      <div key={item.status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-xs text-slate-600">{item.label}</span>
                        <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900">By priority</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {report.byPriority.map((item) => (
                      <span key={item.priority} className={`chip ${PRIORITY_META[item.priority].chip}`}>
                        {PRIORITY_META[item.priority].label}: {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">Complaints in {report.month}</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50/90 text-[10px] tracking-wide text-slate-500 uppercase backdrop-blur">
                      <tr>
                        <th className="px-4 py-2 font-semibold">ID</th>
                        <th className="px-3 py-2 font-semibold">Category</th>
                        <th className="px-3 py-2 font-semibold">Address</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-4 py-2 font-semibold">Filed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <tr key={row.code} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{row.code}</td>
                          <td className="px-3 py-2 text-slate-700">{row.category}</td>
                          <td className="max-w-[18rem] truncate px-3 py-2 text-slate-600">{row.address}</td>
                          <td className="px-3 py-2 text-slate-600">{row.status}</td>
                          <td className="px-4 py-2 text-slate-400">{formatDateTime(row.createdAt)}</td>
                        </tr>
                      ))}
                      {report.rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No complaints recorded for this month.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'teams' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-900">Crews with open assignments</h3>
            <div className="mt-3 space-y-2">
              {workers.workers.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No crews assigned yet. Open a complaint and assign it to a crew.
                </p>
              ) : (
                workers.workers.map((worker) => (
                  <div key={`${worker.name}-${worker.department}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{worker.name}</p>
                      <p className="text-[11px] text-slate-400">{worker.department || 'Unassigned department'}</p>
                    </div>
                    <span className="chip bg-brand-100 text-brand-800">{worker.open} open</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-900">Departments</h3>
            <div className="mt-3 space-y-2">
              {workers.departments.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No departments used yet.</p>
              ) : (
                workers.departments.map((dept) => (
                  <div key={dept.name} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                    <p className="text-sm text-slate-700">{dept.name}</p>
                    <span className="text-xs font-semibold text-slate-500">{dept.total} total</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <ComplaintDrawer
          complaint={detail}
          onClose={() => {
            setDetail(null)
            if (params.get('complaint')) setParams({})
          }}
          onSave={saveComplaint}
          onUpload={uploadPhotos}
          workers={workers.workers}
          departments={workers.departments}
        />
      ) : null}
    </div>
  )
}
