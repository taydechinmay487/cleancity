import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-3xl font-bold text-slate-900">This street is off the map</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        The page you were looking for does not exist. Head back to the homepage or report garbage
        directly.
      </p>
      <div className="mt-6 flex gap-2">
        <Link to="/" className="btn-outline">Back home</Link>
        <Link to="/report" className="btn-primary">Report garbage</Link>
      </div>
    </div>
  )
}
