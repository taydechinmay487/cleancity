import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

const ToastContext = createContext(null)
let counter = 0

const TONES = {
  success: { icon: CheckCircle2, ring: 'border-brand-200', iconColor: 'text-brand-600' },
  error: { icon: XCircle, ring: 'border-red-200', iconColor: 'text-red-600' },
  info: { icon: Info, ring: 'border-sky-200', iconColor: 'text-sky-600' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone, title, message) => {
      const id = ++counter
      setToasts((list) => [...list.slice(-3), { id, tone, title, message }])
      setTimeout(() => dismiss(id), 6000)
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      push,
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      info: (title, message) => push('info', title, message),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[1200] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-4">
        {toasts.map((toast) => {
          const tone = TONES[toast.tone] || TONES.info
          const Icon = tone.icon
          return (
            <div
              key={toast.id}
              className={`animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border ${tone.ring} bg-white p-3.5 shadow-lg shadow-slate-900/5`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.iconColor}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
                {toast.message ? <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{toast.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
