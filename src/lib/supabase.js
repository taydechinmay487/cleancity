import { createClient } from '@supabase/supabase-js'

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

// Treat the .env.example placeholders as "not configured" so the app explains
// what is missing instead of failing against a project that does not exist.
const placeholder = /your-project-ref|your-anon-public-key/i.test(`${url}${anonKey}`)

export const supabaseConfigured = Boolean(url && anonKey) && !placeholder

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'cleancity-auth',
      },
    })
  : null

export const PHOTO_BUCKET = 'complaint-photos'

/** Public object URL for a path stored in complaint_photos.storage_path. */
export function photoUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${url}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`
}
