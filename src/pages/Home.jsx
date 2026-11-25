import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  Radio,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react'
import MapView from '../components/MapView.jsx'
import { fetchPublicMap, fetchPublicStats } from '../lib/data.js'
import { debounce, subscribe } from '../lib/realtime.js'
import { CATEGORY_LABELS, STATUS_META } from '../lib/format.js'

const EMPTY_STATS = { total: 0, resolved: 0, pending: 0, active: 0, avgResolutionHours: null }

export default function Home() {
  const [stats, setStats] = useState(EMPTY_STATS)
  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () =>
      Promise.all([fetchPublicStats(), fetchPublicMap()])
        .then(([nextStats, nextPins]) => {
          if (!alive) return
          setStats(nextStats)
          setPins(nextPins)
        })
        .catch(() => {})
        .finally(() => alive && setLoading(false))

    load()
    const refresh = debounce(load, 600)
    const unsubscribe = subscribe('complaint_feed', { onChange: refresh })

    return () => {
      alive = false
      refresh.cancel()
      unsubscribe()
    }
  }, [])

  const recent = pins.slice(0, 5)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/90 via-white to-white" />
        <div className="absolute -top-24 -right-24 -z-10 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute top-32 -left-20 -z-10 h-64 w-64 rounded-full bg-leaf-500/10 blur-3xl" />

        <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-sm">
              <Radio className="h-3.5 w-3.5" />
              Live between citizens and city crews
            </span>

            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold text-slate-900 sm:text-5xl lg:text-[3.4rem]">
              Report garbage.
              <br />
              Watch your city{' '}
              <span className="relative whitespace-nowrap text-brand-600">
                get cleaner.
                <svg className="absolute -bottom-2 left-0 w-full text-brand-300" viewBox="0 0 200 10" fill="none" preserveAspectRatio="none">
                  <path d="M2 7c40-5 90-6 196-3" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600">
              One photo, your GPS location, and a short note is all it takes. Your report reaches the
              municipal control room instantly, gets assigned to a cleaning crew, and you follow every
              step until the spot is clean.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/report" className="btn-primary px-5 py-3 text-sm">
                <Camera className="h-4 w-4" />
                Report garbage
              </Link>
              <Link to="/track" className="btn-outline px-5 py-3 text-sm">
                Track a complaint
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-slate-200/80 pt-6">
              {[
                { icon: MapPin, label: 'GPS pinned', value: 'Exact spot' },
                { icon: Clock, label: 'Status updates', value: 'Real time' },
                { icon: ShieldCheck, label: 'Every step', value: 'Audit trail' },
              ].map((item) => (
                <div key={item.label}>
                  <item.icon className="h-4 w-4 text-brand-600" />
                  <dt className="mt-2 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{item.label}</dt>
                  <dd className="text-sm font-semibold text-slate-800">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Live map card */}
          <div className="animate-fade-up relative">
            <div className="card overflow-hidden p-2 shadow-xl shadow-brand-900/5">
              <MapView pins={recent} height={340} zoom={11} className="rounded-xl border-0" />
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-600" />
                  </span>
                  <p className="text-xs font-semibold text-slate-700">Live complaint map</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  {stats.total} report{stats.total === 1 ? '' : 's'} · {stats.resolved} cleaned
                </p>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-2 hidden w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:block">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] text-slate-500">Locations cleaned</p>
                  <p className="text-lg leading-none font-bold text-slate-900">{stats.resolved}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="border-y border-slate-200 bg-white">
        <div className="container-page grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
          {[
            { label: 'Complaints filed', value: stats.total, icon: Users },
            { label: 'Awaiting action', value: stats.pending, icon: Clock },
            { label: 'Being cleaned', value: stats.active, icon: Truck },
            { label: 'Resolved', value: stats.resolved, icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <item.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="stat-value">{loading ? '—' : item.value}</p>
                <p className="stat-label mt-0.5">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">How it works</p>
          <h2 className="section-title mt-2">Three steps from a dirty corner to a clean one</h2>
          <p className="section-lead">
            No phone calls, no office visits. The complaint, its photos and its location stay linked to
            the same record the whole way through.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {[
            {
              step: '01',
              icon: Camera,
              title: 'Photograph the spot',
              body: 'Take a photo of the pile, pick the waste type and add a line about what you see.',
            },
            {
              step: '02',
              icon: MapPin,
              title: 'Pin the location',
              body: 'Your GPS fills in the coordinates, or drop a pin on the map if you are reporting somewhere else.',
            },
            {
              step: '03',
              icon: Radio,
              title: 'Follow the clean-up',
              body: 'The control room assigns a crew. You get notified when work starts and when the spot is cleared.',
            },
          ].map((item) => (
            <article key={item.step} className="card relative overflow-hidden p-6">
              <span className="absolute top-4 right-5 text-4xl font-extrabold text-slate-100">{item.step}</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* City map */}
      <section className="border-y border-slate-200 bg-white py-16">
        <div className="container-page grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">The shared map</p>
            <h2 className="section-title mt-2">Every reported pile, on one map</h2>
            <p className="section-lead">
              Citizens see what has already been reported, which keeps duplicate complaints down. The
              authority sees the same pins with full detail, photos and contact history.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                'Pins update live as new complaints arrive',
                'Status colour shows what is new, assigned or cleaned',
                'Nearby complaints are grouped so crews can plan a route',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-2">
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <span key={key} className={`chip ${meta.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              ))}
            </div>
          </div>

          <MapView pins={pins} height={400} zoom={11} className="shadow-lg shadow-slate-900/5" />
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">What you can report</p>
            <h2 className="section-title mt-2">Nine waste categories, each with its own priority</h2>
          </div>
          <Link to="/report" className="btn-outline">
            Start a report
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <div
              key={value}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50"
            >
              {label}
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            </div>
          ))}
        </div>
      </section>

      {/* Authority band */}
      <section className="container-page pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 px-6 py-12 text-white sm:px-12">
          <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" /> For municipal teams
              </span>
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
                A control room that never loses a complaint
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-50/90">
                Filter by area, category, date or priority. Assign crews, upload before-and-after
                evidence, and export a monthly report for the commissioner — all from the same
                dashboard.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/authority/login" className="btn bg-white px-5 py-3 text-sm text-brand-800 hover:bg-brand-50">
                  Authority sign in
                </Link>
                <Link to="/about" className="btn border border-white/30 px-5 py-3 text-sm text-white hover:bg-white/10">
                  How the platform works
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Priority triage', value: 'Urgent first' },
                { label: 'Crew assignment', value: 'Named owners' },
                { label: 'Proof of work', value: 'Before / after' },
                { label: 'Monthly report', value: 'CSV export' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-[11px] tracking-wide text-brand-100/80 uppercase">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="container-page pb-20">
        <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Spotted a pile on your street?</h2>
          <p className="max-w-lg text-sm text-slate-600">
            It takes about a minute. Add a photo, confirm the location, and the right team is notified.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/report" className="btn-primary px-5 py-3">
              Report garbage
            </Link>
            <Link to="/register" className="btn-outline px-5 py-3">
              Create an account
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
