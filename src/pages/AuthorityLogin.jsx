import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../lib/toast.jsx'

export default function AuthorityLogin() {
  const { user, loading, login, registerAuthority } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    inviteCode: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return null
  if (user) {
    return <Navigate to={user.role === 'citizen' ? '/dashboard' : '/authority'} replace />
  }

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const account = await login({ email: form.email, password: form.password, portal: 'authority' })
        toast.success('Signed in', `Welcome, ${account.name}.`)
        navigate(location.state?.from || '/authority', { replace: true })
      } else {
        const account = await registerAuthority(form)
        toast.success('Authority account created', `Signed in as ${account.name}.`)
        navigate('/authority', { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700" />
      <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-14">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center text-white">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="mt-3 text-2xl font-bold">Municipal authority portal</h1>
            <p className="mt-1 text-sm text-brand-100/80">
              Restricted access for cleaning supervisors and administrators.
            </p>
          </div>

          <div className="card p-7">
            <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
              {[
                { value: 'login', label: 'Sign in' },
                { value: 'register', label: 'Register with invite' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setMode(tab.value)
                    setError('')
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    mode === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' ? (
                <>
                  <div>
                    <label className="label" htmlFor="name">Full name</label>
                    <input id="name" className="input" value={form.name} onChange={set('name')} required />
                  </div>
                  <div>
                    <label className="label" htmlFor="department">Department</label>
                    <input
                      id="department"
                      className="input"
                      value={form.department}
                      onChange={set('department')}
                      placeholder="Solid Waste Management"
                    />
                  </div>
                </>
              ) : null}

              <div>
                <label className="label" htmlFor="email">Work email</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={set('email')}
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
                  onChange={set('password')}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                  required
                />
              </div>

              {mode === 'register' ? (
                <div>
                  <label className="label" htmlFor="invite">Invite code</label>
                  <div className="relative">
                    <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="invite"
                      className="input pl-9"
                      value={form.inviteCode}
                      onChange={set('inviteCode')}
                      placeholder="Provided by the municipal administrator"
                      required
                    />
                  </div>
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {mode === 'login' ? 'Sign in to dashboard' : 'Create authority account'}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-500">
              Citizen?{' '}
              <Link to="/login" className="font-semibold text-brand-700 hover:underline">
                Use the citizen sign-in
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-[11px] text-brand-100/70">
            Access is logged. Every status change is attributed to the account that made it.
          </p>
        </div>
      </div>
    </div>
  )
}
