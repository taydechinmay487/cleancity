import { Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              <Leaf className="h-4 w-4" />
            </span>
            <span className="font-bold text-slate-900">
              Clean<span className="text-brand-600">City</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-500">
            A shared map of what needs cleaning. Citizens report, the municipality resolves, and
            everyone can watch the progress.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Citizens</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link to="/report" className="hover:text-brand-700">Report garbage</Link></li>
            <li><Link to="/track" className="hover:text-brand-700">Track a complaint</Link></li>
            <li><Link to="/register" className="hover:text-brand-700">Create an account</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Municipality</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link to="/authority/login" className="hover:text-brand-700">Authority sign in</Link></li>
            <li><Link to="/authority" className="hover:text-brand-700">Operations dashboard</Link></li>
            <li><Link to="/about" className="hover:text-brand-700">About the initiative</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Platform</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>React + Tailwind frontend</li>
            <li>Supabase Postgres + row level security</li>
            <li>Supabase Realtime sync</li>
            <li>OpenStreetMap + Leaflet</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-4 text-[11px] text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} CleanCity. A cleaner city is a shared effort.</p>
          <p>Report responsibly. False complaints delay real clean-ups.</p>
        </div>
      </div>
    </footer>
  )
}
