import { supabase } from './supabase.js'

/**
 * Subscribes to row changes on a public table. Supabase Realtime enforces the
 * same row level security as a normal query, so a citizen only receives their
 * own rows and guests only receive the public complaint feed.
 *
 * Returns an unsubscribe function.
 */
export function subscribe(table, { filter, event = '*', onChange } = {}) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`cc:${table}:${filter || 'all'}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event, schema: 'public', table, ...(filter ? { filter } : {}) },
      (payload) => onChange?.(payload),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/** Collapses bursts of realtime events into one refresh. */
export function debounce(fn, wait = 400) {
  let timer = null
  const wrapped = (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, wait)
  }
  wrapped.cancel = () => timer && clearTimeout(timer)
  return wrapped
}
