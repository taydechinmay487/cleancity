import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Database, Leaf, MapPin, ShieldCheck, Truck, Users } from 'lucide-react'

export default function About() {
  return (
    <div className="container-page py-12">
      <div className="max-w-3xl">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">About CleanCity</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Clean streets are a coordination problem, not a complaint problem.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
          Most cities already receive complaints. What they lack is a shared record: the citizen knows
          what they saw, the crew knows what they were sent to, and nobody can prove what happened in
          between. CleanCity keeps that record in one place — with photos, coordinates, the assigned
          crew and a timestamped history — and shows it to both sides.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Users,
            title: 'For citizens',
            body: 'Report in under a minute with a photo and GPS pin. Follow the status without calling anyone. Every update arrives as a notification.',
          },
          {
            icon: Truck,
            title: 'For cleaning crews',
            body: 'Named assignments, addresses, landmarks and site photos. Crews upload before-and-after evidence from the field.',
          },
          {
            icon: ClipboardList,
            title: 'For the municipality',
            body: 'A live operations view: priorities, ageing complaints, crew load, resolution time and a monthly report you can export.',
          },
        ].map((item) => (
          <article key={item.title} className="card p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <item.icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
          </article>
        ))}
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="text-xl font-bold text-slate-900">How a complaint travels</h2>
          <ol className="mt-5 space-y-4">
            {[
              'A citizen submits photos, coordinates, waste type and contact details. A unique ID is generated.',
              'The complaint is written to the database and pushed to every open authority dashboard instantly.',
              'A supervisor acknowledges it, sets the priority and assigns a crew or department.',
              'The crew starts work; the citizen sees “Cleaning in progress” without refreshing the page.',
              'The crew uploads after photos and remarks. The complaint is marked resolved with proof attached.',
              'Every step is stored in the history, which powers monthly reporting and accountability.',
            ].map((line, index) => (
              <li key={line} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-slate-700">{line}</p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900">What the platform enforces</h3>
            <ul className="mt-3 space-y-2.5">
              {[
                'Citizens cannot change status, priority or assignments',
                'Public tracking never reveals phone numbers or emails',
                'Every authority action is recorded against a named user',
                'Images are type- and size-checked before storage',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900">Built with</h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2"><Leaf className="h-3.5 w-3.5 text-brand-600" /> React + Tailwind CSS</li>
              <li className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-brand-600" /> Supabase Postgres + row level security</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-brand-600" /> Supabase Realtime sync</li>
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-brand-600" /> Leaflet + OpenStreetMap</li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="mt-12 rounded-3xl bg-brand-800 px-6 py-10 text-white sm:px-10">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold">Helping a municipality adopt CleanCity</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-50/90">
            The platform is intentionally small to operate: one backend process, one database file, and
            the browser does the rest. Email notifications work as soon as SMTP credentials are added,
            and the notification layer is written so SMS or WhatsApp delivery can be attached without
            touching the complaint flow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/report" className="btn bg-white px-5 py-3 text-sm text-brand-800 hover:bg-brand-50">
              Report garbage
            </Link>
            <Link to="/authority/login" className="btn border border-white/30 px-5 py-3 text-sm text-white hover:bg-white/10">
              Authority sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
