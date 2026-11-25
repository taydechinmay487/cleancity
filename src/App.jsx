import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import { useAuth } from './lib/auth.jsx'
import { supabaseConfigured } from './lib/supabase.js'
import Home from './pages/Home.jsx'
import Report from './pages/Report.jsx'
import Track from './pages/Track.jsx'
import About from './pages/About.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import CitizenDashboard from './pages/CitizenDashboard.jsx'
import AuthorityLogin from './pages/AuthorityLogin.jsx'
import AuthorityDashboard from './pages/AuthorityDashboard.jsx'
import NotFound from './pages/NotFound.jsx'

function MissingConfig() {
  return (
    <div className="container-page py-20">
      <div className="card mx-auto max-w-xl p-8">
        <h1 className="text-xl font-bold text-slate-900">Connect your Supabase project</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Complaints, accounts, photos and live updates are stored in Supabase. Add your project URL and
          anon key to <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">.env</code> as{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">VITE_SUPABASE_ANON_KEY</code>,
          then restart the dev server.
        </p>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="container-page py-24">
      <div className="mx-auto max-w-md space-y-3">
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    </div>
  )
}

function RequireCitizen({ children }) {
  const { user, loading, isStaff } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (isStaff) return <Navigate to="/authority" replace />
  return children
}

function RequireStaff({ children }) {
  const { user, loading, isStaff } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/authority/login" replace state={{ from: location.pathname }} />
  if (!isStaff) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  if (!supabaseConfigured) return <MissingConfig />

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<Report />} />
          <Route path="/track" element={<Track />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <RequireCitizen>
                <CitizenDashboard />
              </RequireCitizen>
            }
          />
          <Route path="/authority/login" element={<AuthorityLogin />} />
          <Route
            path="/authority"
            element={
              <RequireStaff>
                <AuthorityDashboard />
              </RequireStaff>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
