import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  ImagePlus,
  Loader2,
  MapPin,
  Phone,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import BeforeAfter from './BeforeAfter.jsx'
import MapView from './MapView.jsx'
import { PriorityChip, StatusChip } from './StatusBadge.jsx'
import {
  CATEGORY_LABELS,
  PRIORITY_META,
  STATUS_META,
  STATUS_ORDER,
  categoryLabel,
  formatDateTime,
} from '../lib/format.js'

export default function ComplaintDrawer({ complaint, onClose, onSave, onUpload, workers = [], departments = [] }) {
  const [form, setForm] = useState({
    status: 'new',
    priority: 'medium',
    assignedTo: '',
    department: '',
    note: '',
    resolution: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const fileRef = useRef(null)
  const uploadKind = useRef('before')

  useEffect(() => {
    if (!complaint) return
    setForm({
      status: complaint.status,
      priority: complaint.priority,
      assignedTo: complaint.assignedTo || '',
      department: complaint.department || '',
      note: '',
      resolution: complaint.resolution || '',
    })
  }, [complaint?.id, complaint?.status, complaint?.priority, complaint?.assignedTo, complaint?.department, complaint?.resolution])

  if (!complaint) return null

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave({
        status: form.status,
        priority: form.priority,
        assignedTo: form.assignedTo,
        department: form.department,
        note: form.note,
        resolution: form.status === 'resolved' ? form.resolution : undefined,
      })
      setForm((current) => ({ ...current, note: '' }))
    } finally {
      setSaving(false)
    }
  }

  const pickPhoto = (kind) => {
    uploadKind.current = kind
    fileRef.current?.click()
  }

  const handleFiles = async (files) => {
    if (!files?.length) return
    setUploading(uploadKind.current)
    try {
      await onUpload(uploadKind.current, files)
    } finally {
      setUploading('')
    }
  }

  const reportPhotos = complaint.photos.filter((p) => p.kind === 'report')
  const before = complaint.photos.find((p) => p.kind === 'before') || reportPhotos[0]
  const after = complaint.photos.find((p) => p.kind === 'after')

  return (
    <div className="fixed inset-0 z-[1050] flex justify-end bg-slate-900/40 backdrop-blur-sm">
      <button type="button" className="flex-1" aria-label="Close complaint" onClick={onClose} />
      <aside className="animate-fade-up flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wider text-slate-400">{complaint.code}</p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">
              {categoryLabel(complaint.category)}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusChip status={complaint.status} />
              <PriorityChip priority={complaint.priority} />
              {complaint.anonymous ? <span className="chip bg-slate-100 text-slate-600">Anonymous</span> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {/* Location */}
          <section className="card overflow-hidden">
            <MapView
              pins={[{ ...complaint, id: complaint.id }]}
              center={[complaint.lat, complaint.lng]}
              zoom={15}
              height={190}
              selectedId={complaint.id}
              className="rounded-none border-0"
            />
            <div className="space-y-1 px-4 py-3 text-xs text-slate-600">
              <p className="flex items-start gap-1.5 font-medium text-slate-800">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                {complaint.address}
              </p>
              {complaint.landmark ? <p className="pl-5 text-slate-500">Landmark: {complaint.landmark}</p> : null}
              <p className="pl-5 font-mono text-[11px] text-slate-400">
                {complaint.lat.toFixed(6)}, {complaint.lng.toFixed(6)}
              </p>
            </div>
          </section>

          {/* Reporter + description */}
          <section className="card p-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-slate-400" />
                {complaint.anonymous ? 'Anonymous citizen' : complaint.reporterName}
              </span>
              {complaint.reporterPhone ? (
                <a href={`tel:${complaint.reporterPhone}`} className="inline-flex items-center gap-1.5 font-medium text-brand-700">
                  <Phone className="h-3.5 w-3.5" /> {complaint.reporterPhone}
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {formatDateTime(complaint.createdAt)}
              </span>
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-700">
              {complaint.description}
            </p>
          </section>

          {/* Photos */}
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Site photos</h3>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => pickPhoto('before')} className="btn-outline btn-sm" disabled={!!uploading}>
                  {uploading === 'before' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  Before
                </button>
                <button type="button" onClick={() => pickPhoto('after')} className="btn-outline btn-sm" disabled={!!uploading}>
                  {uploading === 'after' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  After
                </button>
              </div>
            </div>

            <div className="mt-3">
              <BeforeAfter before={before?.url} after={after?.url} />
            </div>

            {reportPhotos.length ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {reportPhotos.map((photo) => (
                  <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-slate-200">
                    <img src={photo.url} alt="Reported site" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">The citizen did not attach photos.</p>
            )}
          </section>

          {/* Manage */}
          <section className="card p-4">
            <h3 className="text-sm font-semibold text-slate-900">Manage complaint</h3>
            <form onSubmit={submit} className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="drawer-status">Status</label>
                  <select id="drawer-status" className="select" value={form.status} onChange={set('status')}>
                    {STATUS_ORDER.map((value) => (
                      <option key={value} value={value}>{STATUS_META[value].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="drawer-priority">Priority</label>
                  <select id="drawer-priority" className="select" value={form.priority} onChange={set('priority')}>
                    {Object.entries(PRIORITY_META).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="drawer-crew">Assign to crew / worker</label>
                  <input
                    id="drawer-crew"
                    className="input"
                    list="drawer-workers"
                    value={form.assignedTo}
                    onChange={set('assignedTo')}
                    placeholder="e.g. Zone 4 night crew"
                  />
                  <datalist id="drawer-workers">
                    {workers.map((worker) => (
                      <option key={worker.name} value={worker.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label" htmlFor="drawer-dept">Department</label>
                  <input
                    id="drawer-dept"
                    className="input"
                    list="drawer-departments"
                    value={form.department}
                    onChange={set('department')}
                    placeholder="Solid Waste Management"
                  />
                  <datalist id="drawer-departments">
                    {departments.map((dept) => (
                      <option key={dept.name} value={dept.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="drawer-note">Remark (added to history)</label>
                <textarea
                  id="drawer-note"
                  className="textarea min-h-20"
                  value={form.note}
                  onChange={set('note')}
                  placeholder="Crew dispatched for the 6 am shift; access blocked by a parked truck."
                />
              </div>

              {form.status === 'resolved' ? (
                <div>
                  <label className="label" htmlFor="drawer-resolution">Resolution details</label>
                  <textarea
                    id="drawer-resolution"
                    className="textarea min-h-20"
                    value={form.resolution}
                    onChange={set('resolution')}
                    placeholder="What was cleaned, how much waste was removed, and where it was taken."
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save update
                </button>
                <span className="text-[11px] text-slate-400">
                  The citizen is notified for acknowledged, assigned, in-progress and resolved.
                </span>
              </div>
            </form>
          </section>

          {/* History */}
          <section className="card p-4">
            <h3 className="text-sm font-semibold text-slate-900">Status history</h3>
            <ol className="mt-3 space-y-3">
              {complaint.history?.map((entry) => (
                <li key={entry.id} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700">{entry.note || STATUS_META[entry.status]?.label}</p>
                    <p className="text-[10px] text-slate-400">
                      {entry.actor_name} ({entry.actor_role}) · {formatDateTime(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
              {!complaint.history?.length ? <li className="text-xs text-slate-400">No history yet.</li> : null}
            </ol>
          </section>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFiles(Array.from(event.target.files || []))
            event.target.value = ''
          }}
        />
      </aside>
    </div>
  )
}
