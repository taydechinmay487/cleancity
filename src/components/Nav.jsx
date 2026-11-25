import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Leaf, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import NotificationBell from './NotificationBell.jsx'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/report', label: 'Report garbage' },
  { to: '/track', label: 'Track complaint' },
  { to: '/about', label: 'About' },
]

export default function Nav() {
  const { user, isStaff, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => setOpen(false), [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
      <div className="container-page flex h-16 items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Clean<span className="text-brand-600">City</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
          {isStaff ? (
            <NavLink to="/authority" className={linkClass}>
              Authority
            </NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell />

          {user ? (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Link
                to={isStaff ? '/authority' : '/dashboard'}
                className="btn-outline btn-sm"
              >
                {isStaff ? <ShieldCheck className="h-3.5 w-3.5" /> : <LayoutDashboard className="h-3.5 w-3.5" />}
                {isStaff ? 'Dashboard' : 'My complaints'}
              </Link>
              <button type="button" onClick={handleLogout} className="btn-ghost btn-sm" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Link to="/login" className="btn-ghost btn-sm">
                Sign in
              </Link>
              <Link to="/report" className="btn-primary btn-sm">
                Report garbage
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="animate-fade-up border-t border-slate-100 bg-white md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
            {isStaff ? (
              <NavLink to="/authority" className={linkClass}>
                Authority dashboard
              </NavLink>
            ) : null}

            <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
              {user ? (
                <>
                  <Link to={isStaff ? '/authority' : '/dashboard'} className="btn-outline">
                    {isStaff ? 'Authority dashboard' : 'My complaints'}
                  </Link>
                  <button type="button" onClick={handleLogout} className="btn-ghost">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-outline">
                    Sign in
                  </Link>
                  <Link to="/report" className="btn-primary">
                    Report garbage
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
