import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/data.js'
import { debounce, subscribe } from '../lib/realtime.js'
import { useAuth } from '../lib/auth.jsx'
import { timeAgo } from '../lib/format.js'

export default function NotificationBell() {
  const { user, isStaff } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    const load = () =>
      listNotifications()
        .then((list) => alive && setItems(list))
        .catch(() => {})

    load()
    const refresh = debounce(load, 400)
    const unsubscribe = subscribe('notifications', {
      filter: `user_id=eq.${user.id}`,
      onChange: refresh,
    })

    return () => {
      alive = false
      refresh.cancel()
      unsubscribe()
    }
  }, [user?.id])

  useEffect(() => {
    const onClick = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) return null
  const unread = items.filter((n) => !n.read).length

  const markAll = async () => {
    await markAllNotificationsRead().catch(() => {})
    setItems((current) => current.map((n) => ({ ...n, read: true })))
  }

  const openItem = async (item) => {
    setOpen(false)
    if (!item.read) {
      markNotificationRead(item.id).catch(() => {})
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
    }
    if (item.complaintCode) {
      navigate(isStaff ? `/authority?complaint=${item.complaintCode}` : `/dashboard?code=${item.complaintCode}`)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="animate-fade-up absolute right-0 z-[1100] mt-2 w-[21rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              type="button"
              onClick={markAll}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">
                No notifications yet. You will be alerted when a complaint moves.
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`flex w-full gap-2.5 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    item.read ? '' : 'bg-brand-50/40'
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? 'bg-slate-200' : 'bg-brand-500'}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-800">{item.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">
                      {item.body}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {timeAgo(item.createdAt)} · email {item.emailStatus || 'pending'}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
