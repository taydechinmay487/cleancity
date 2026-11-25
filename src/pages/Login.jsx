import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../lib/toast.jsx'

export default function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return null
  if (user) return <Navigate to={user.role === 'citizen' ? '/dashboard' : '/authority'} replace />

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const account = await login({ ...form, portal: 'citizen' })
      toast.success('Welcome back', `Signed in as ${account.name}.`)
      navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-page flex justify-center py-14">
      <div className="w-full max-w-md">
        <div className="card p-7">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in to see your complaints and their progress.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete="current-password"
                required
              />
            </div>

            {error ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Sign in
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            New here?{' '}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
          Municipal staff?{' '}
          <Link to="/authority/login" className="font-semibold text-brand-700 hover:underline">
            Use the authority portal
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          You can also{' '}
          <Link to="/report" className="font-semibold text-brand-700 hover:underline">report as a guest</Link>{' '}
          without an account.
        </p>
      </div>
    </div>
  )
}
