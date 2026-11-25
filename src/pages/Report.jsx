import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Crosshair,
  Loader2,
  MapPin,
  ShieldCheck,
  Send,
} from 'lucide-react'
import PhotoPicker from '../components/PhotoPicker.jsx'
import MapPicker from '../components/MapPicker.jsx'
import { createComplaint } from '../lib/data.js'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../lib/toast.jsx'
import { CATEGORY_LABELS } from '../lib/format.js'

const CATEGORY_HINTS = {
  household: 'Mixed household rubbish left on a street corner or bin overflow.',
  plastic: 'Bottles, bags and packaging piling up in the open.',
  construction: 'Rubble, cement bags or demolition material dumped on a plot.',
  ewaste: 'Discarded electronics, cables, batteries or appliances.',
  medical: 'Masks, syringes or clinical waste dumped in public — treat as urgent.',
  sewage: 'Overflowing drain or liquid waste pooling on the road.',
  deadanimal: 'Carcass in a public place — handled as an urgent health risk.',
  organic: 'Garden trimmings, leaves or food waste.',
  other: 'Anything that does not fit the categories above.',
}

const DEFAULT_FORM = {
  category: 'household',
  description: '',
  address: '',
  landmark: '',
  name: '',
  phone: '',
  email: '',
  anonymous: false,
}

export default function Report() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState(DEFAULT_FORM)
  const [photos, setPhotos] = useState([])
  const [coords, setCoords] = useState(null)
  const [gps, setGps] = useState('idle')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [duplicate, setDuplicate] = useState(null)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm((current) => ({
      ...current,
      name: current.name || user.name || '',
      phone: current.phone || user.phone || '',
      email: current.email || user.email || '',
    }))
  }, [user])

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [key]: value }))
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGps('unsupported')
      return
    }
    setGps('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude }
        setCoords(next)
        setGps('ok')
        reverseGeocode(next)
      },
      () => setGps('error'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  }

  const reverseGeocode = async (point) => {
    setLocating(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}`,
        { headers: { Accept: 'application/json' } },
      )
      if (!res.ok) throw new Error('lookup failed')
      const data = await res.json()
      const label = data.display_name
      if (label) setForm((current) => (current.address ? current : { ...current, address: label }))
    } catch {
      // Address lookup is a convenience; the citizen can always type it.
    } finally {
      setLocating(false)
    }
  }

  const handleCoordsChange = (point) => {
    setCoords(point)
    setGps('manual')
    reverseGeocode(point)
  }

  const priorityHint = useMemo(() => {
    const weight = { medical: 4, sewage: 4, deadanimal: 4, construction: 3, ewaste: 3, household: 2, plastic: 2, organic: 1, other: 1 }[form.category]
    return weight >= 4 ? 'Urgent' : weight === 3 ? 'High' : weight === 2 ? 'Medium' : 'Low'
  }, [form.category])

  const submit = async (force = false) => {
    setError('')
    setDuplicate(null)

    if (!coords) return setError('Share your GPS location or tap the map to pin the spot.')
    if (form.description.trim().length < 10) return setError('Please describe the problem in at least 10 characters.')
    if (form.address.trim().length < 5) return setError('Please enter the location or address.')
    if (!/^[+0-9][0-9\s\-()]{6,19}$/.test(form.phone.trim())) {
      return setError('Please enter a contact phone number.')
    }
    if (!form.anonymous && form.name.trim().length < 2) {
      return setError('Please enter your name, or switch on anonymous reporting.')
    }

    setSubmitting(true)
    try {
      const complaint = await createComplaint({ values: form, coords, photos, force })
      setResult(complaint)
      toast.success('Complaint submitted', `Your complaint ID is ${complaint.code}.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (err.status === 409 && err.data?.duplicate) {
        setDuplicate(err.data.duplicate)
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(result.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (result) {
    return (
      <div className="container-page py-14">
        <div className="card animate-fade-up mx-auto max-w-2xl p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Complaint submitted</h1>
          <p className="mt-2 text-sm text-slate-600">
            The municipal control room has been notified. Save your complaint ID to follow the
            clean-up.
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3">
            <span className="font-mono text-xl font-bold tracking-wider text-brand-800">{result.code}</span>
            <button type="button" onClick={copyCode} className="btn-ghost btn-sm" title="Copy complaint ID">
              {copied ? <Check className="h-4 w-4 text-brand-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <dl className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            {[
              { label: 'Waste type', value: CATEGORY_LABELS[result.category] },
              { label: 'Priority', value: `${result.priority} priority` },
              { label: 'Photos', value: `${result.photos.length} attached` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{item.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-800 capitalize">{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to={`/track?code=${result.code}`} className="btn-primary">
              Track this complaint
            </Link>
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-outline">
              My complaints
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null)
                setForm({ ...DEFAULT_FORM, name: user?.name || '', phone: user?.phone || '', email: user?.email || '' })
                setPhotos([])
                setCoords(null)
                setGps('idle')
              }}
              className="btn-ghost"
            >
              Report another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">Report garbage</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Tell us what needs cleaning</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Photos and an accurate pin make the biggest difference. You will get a complaint ID you can
          track at any time.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            submit(false)
          }}
        >
          {/* Photos */}
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">1</span>
              <h2 className="text-sm font-semibold text-slate-900">Photos of the spot</h2>
            </div>
            <div className="mt-4">
              <PhotoPicker
                files={photos}
                onChange={setPhotos}
                hint="One wide shot showing the pile and its surroundings helps the crew find it. Up to 6 photos, 8 MB each."
              />
            </div>
          </section>

          {/* Location */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">2</span>
                <h2 className="text-sm font-semibold text-slate-900">Where is it?</h2>
              </div>
              <button type="button" onClick={requestLocation} className="btn-outline btn-sm" disabled={gps === 'loading'}>
                {gps === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                Use my GPS location
              </button>
            </div>

            <div className="mt-4">
              <MapPicker value={coords} onChange={handleCoordsChange} height={260} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {coords ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
                  <MapPin className="h-3.5 w-3.5" />
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  {locating ? <span className="text-slate-400">· looking up address…</span> : null}
                </span>
              ) : (
                <span className="text-slate-500">No location yet — tap the map or share GPS.</span>
              )}
              {gps === 'error' ? (
                <span className="text-amber-700">Location permission was blocked. Pick the spot on the map instead.</span>
              ) : null}
              {gps === 'unsupported' ? (
                <span className="text-amber-700">This browser cannot share GPS. Pick the spot on the map.</span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="address">Full address / location</label>
                <input
                  id="address"
                  className="input"
                  value={form.address}
                  onChange={set('address')}
                  placeholder="Street, area, city"
                  autoComplete="street-address"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="landmark">Landmark (optional)</label>
                <input
                  id="landmark"
                  className="input"
                  value={form.landmark}
                  onChange={set('landmark')}
                  placeholder="Near the bus stop, opposite the school gate…"
                />
              </div>
            </div>
          </section>

          {/* Details */}
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">3</span>
              <h2 className="text-sm font-semibold text-slate-900">What is there?</h2>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="category">Type of garbage</label>
                <select id="category" className="select" value={form.category} onChange={set('category')}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{CATEGORY_HINTS[form.category]}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Automatic priority</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{priorityHint}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Set from the waste type. Medical, sewage and animal waste are triaged first.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor="description">Description of the problem</label>
                <textarea
                  id="description"
                  className="textarea"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="How large is the pile? Is it blocking the footpath? Has it been there for days?"
                  maxLength={800}
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">{form.description.length}/800</p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">4</span>
              <h2 className="text-sm font-semibold text-slate-900">Your contact details</h2>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input
                  id="name"
                  className="input"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Your name"
                  disabled={form.anonymous}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="label" htmlFor="phone">Phone number</label>
                <input
                  id="phone"
                  className="input"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+91 98765 43210"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="email">Email for updates (optional)</label>
                <input
                  id="email"
                  className="input"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <input
                type="checkbox"
                checked={form.anonymous}
                onChange={set('anonymous')}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">Report anonymously</span>
                <span className="block text-xs leading-relaxed text-slate-500">
                  Your name is hidden from the public map and from other citizens. The municipality still
                  needs the phone number to reach you if access is blocked.
                </span>
              </span>
            </label>

            {!user ? (
              <p className="mt-3 text-xs text-slate-500">
                <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>{' '}
                to keep every complaint in one place. Reporting as a guest still works.
              </p>
            ) : null}
          </section>

          {duplicate ? (
            <div className="animate-fade-up rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Possible duplicate</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    You already reported this spot today as{' '}
                    <Link to={`/track?code=${duplicate.code}`} className="font-mono font-bold underline">
                      {duplicate.code}
                    </Link>
                    . Submitting again creates a separate complaint.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => submit(true)} className="btn bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700">
                      Submit anyway
                    </button>
                    <Link to={`/track?code=${duplicate.code}`} className="btn-outline btn-sm">
                      View existing complaint
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary px-5 py-3" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Submitting…' : 'Submit complaint'}
            </button>
            <p className="text-xs text-slate-500">
              You will receive a complaint ID immediately after submitting.
            </p>
          </div>
        </form>

        {/* Side rail */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900">What happens next</h3>
            <ol className="mt-4 space-y-4">
              {[
                { title: 'Control room receives it', body: 'New complaints appear on the authority dashboard instantly.' },
                { title: 'Triage and assignment', body: 'A supervisor sets priority and assigns a crew or department.' },
                { title: 'Cleaning in progress', body: 'The crew uploads site photos as work starts.' },
                { title: 'Resolved with proof', body: 'After photos and remarks close the complaint. You are notified.' },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-800">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-5">
            <ShieldCheck className="h-5 w-5 text-brand-700" />
            <h3 className="mt-2 text-sm font-semibold text-brand-900">A good report gets fixed faster</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-brand-900/80">
              <li>• Include one photo of the whole pile</li>
              <li>• Put the pin on the exact corner, not the street centre</li>
              <li>• Mention the landmark the crew will recognise</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
