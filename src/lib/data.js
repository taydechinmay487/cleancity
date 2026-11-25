import { supabase, photoUrl, PHOTO_BUCKET } from './supabase.js'

const COMPLAINT_SELECT = `
  id, code, category, description, address, landmark, lat, lng, priority, status,
  assigned_to, department, resolution, anonymous, reporter_name, reporter_phone, reporter_email,
  user_id, created_at, updated_at, acknowledged_at, resolved_at,
  complaint_photos (id, kind, storage_path, created_at),
  status_history (id, status, note, actor_name, actor_role, created_at)
`

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

function fail(error, fallback = 'Something went wrong.') {
  const message = error?.message || fallback
  const err = new Error(message)
  err.status = error?.code === 'P0001' ? 422 : 500
  throw err
}

/** Turns the JSON returned by the SQL functions into the shape the UI expects. */
function decorate(complaint) {
  if (!complaint) return null
  return {
    ...complaint,
    photos: (complaint.photos || []).map((photo) => ({
      id: photo.id,
      kind: photo.kind,
      url: photoUrl(photo.path || photo.url),
    })),
    history: complaint.history || [],
  }
}

function mapComplaint(row) {
  if (!row) return null
  return decorate({
    id: row.id,
    code: row.code,
    category: row.category,
    description: row.description,
    address: row.address,
    landmark: row.landmark,
    lat: row.lat,
    lng: row.lng,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    department: row.department,
    resolution: row.resolution,
    anonymous: row.anonymous,
    reporterName: row.anonymous ? 'Anonymous citizen' : row.reporter_name,
    reporterPhone: row.anonymous ? null : row.reporter_phone,
    reporterEmail: row.anonymous ? null : row.reporter_email,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    photos: (row.complaint_photos || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((photo) => ({ id: photo.id, kind: photo.kind, path: photo.storage_path })),
    history: (row.status_history || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  })
}

async function uploadPhotos(folder, files) {
  const db = client()
  const paths = []
  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) throw new Error('Each photo must be 8 MB or smaller.')
    const safe = (file.name || 'photo').replace(/[^\w.-]+/g, '-').slice(-48)
    const path = `${folder}/${crypto.randomUUID()}-${safe}`
    const { error } = await db.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
    if (error) fail(error, 'Could not upload the photo.')
    paths.push(path)
  }
  return paths
}

async function discardPhotos(paths) {
  if (!paths.length) return
  await client().storage.from(PHOTO_BUCKET).remove(paths).catch(() => {})
}

/**
 * Email delivery runs on a small Worker so the mail provider key never reaches
 * the browser. Failure is silent: the in-app notification is already stored.
 */
export function dispatchEmails() {
  if (!supabase) return
  supabase.auth
    .getSession()
    .then(({ data }) => {
      const token = data?.session?.access_token
      if (!token) return
      fetch('/api/notify/dispatch', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => {})
    })
    .catch(() => {})
}

/* ------------------------------------------------------------------ public */

export async function fetchPublicStats() {
  const { data, error } = await client().rpc('public_stats')
  if (error) fail(error)
  return data || { total: 0, resolved: 0, pending: 0, active: 0, avgResolutionHours: null, categories: 0 }
}

export async function fetchPublicMap() {
  const { data, error } = await client().rpc('public_map')
  if (error) fail(error)
  return Array.isArray(data) ? data : []
}

export async function trackComplaint(code) {
  const { data, error } = await client().rpc('track_complaint', { p_code: code })
  if (error) fail(error)
  return decorate(data)
}

/* ----------------------------------------------------------------- citizen */

export async function createComplaint({ values, coords, photos = [], force = false }) {
  const db = client()
  const { data: session } = await db.auth.getUser()
  const uid = session?.user?.id || null
  const folder = uid || 'guest'

  const paths = await uploadPhotos(folder, photos)

  const { data, error } = await db.rpc('create_complaint', {
    p: {
      ...values,
      lat: coords.lat,
      lng: coords.lng,
      force,
      photos: paths,
    },
  })

  if (error) {
    await discardPhotos(paths)
    fail(error, 'Could not submit the complaint.')
  }

  if (!data?.ok) {
    await discardPhotos(paths)
    if (data?.reason === 'duplicate') {
      const err = new Error(`You already reported this spot today as ${data.duplicate?.code}.`)
      err.status = 409
      err.data = { duplicate: data.duplicate }
      throw err
    }
    throw new Error(data?.error || 'Could not submit the complaint.')
  }

  dispatchEmails()
  return decorate(data.complaint)
}

export async function listMyComplaints() {
  const db = client()
  const { data: userData } = await db.auth.getUser()
  if (!userData?.user?.id) return []
  const { data, error } = await db
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })
  if (error) fail(error)
  return (data || []).map(mapComplaint)
}

export async function getComplaint(id) {
  const { data, error } = await client()
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) fail(error)
  if (!data) throw new Error('Complaint not found.')
  return mapComplaint(data)
}

export async function addCitizenNote(id, note) {
  const { error } = await client().rpc('add_citizen_note', { p_id: id, p_note: note })
  if (error) fail(error)
  return true
}

/* ------------------------------------------------------------ notifications */

export async function listNotifications() {
  const db = client()
  const { data: userData } = await db.auth.getUser()
  if (!userData?.user?.id) return []
  const { data, error } = await db
    .from('notifications')
    .select('id, type, title, body, read_at, email_status, created_at, complaint_id, complaints (code)')
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) fail(error)
  return (data || []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    read: Boolean(row.read_at),
    emailStatus: row.email_status,
    complaintCode: row.complaints?.code || null,
    complaintId: row.complaint_id,
    createdAt: row.created_at,
  }))
}

export async function markNotificationRead(id) {
  const { error } = await client()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) fail(error)
}

export async function markAllNotificationsRead() {
  const db = client()
  const { data: userData } = await db.auth.getUser()
  if (!userData?.user?.id) return
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userData.user.id)
    .is('read_at', null)
  if (error) fail(error)
}

/* -------------------------------------------------------------- authority */

export async function fetchAdminStats() {
  const { data, error } = await client().rpc('admin_stats')
  if (error) fail(error)
  return data
}

const STATUS_VALUES = ['new', 'acknowledged', 'assigned', 'in_progress', 'resolved']
const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent']
const CATEGORY_VALUES = [
  'household',
  'plastic',
  'construction',
  'ewaste',
  'medical',
  'sewage',
  'deadanimal',
  'organic',
  'other',
]

export async function listComplaints(filters = {}) {
  let query = client()
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .order('created_at', { ascending: false })
    .limit(300)

  if (STATUS_VALUES.includes(filters.status)) query = query.eq('status', filters.status)
  if (CATEGORY_VALUES.includes(filters.category)) query = query.eq('category', filters.category)
  if (PRIORITY_VALUES.includes(filters.priority)) query = query.eq('priority', filters.priority)
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00.000Z`)
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59.999Z`)

  const term = String(filters.q || '').replace(/[,()%]/g, ' ').trim()
  if (term) {
    query = query.or(
      [
        `address.ilike.%${term}%`,
        `description.ilike.%${term}%`,
        `code.ilike.%${term}%`,
        `reporter_name.ilike.%${term}%`,
        `assigned_to.ilike.%${term}%`,
      ].join(','),
    )
  }

  const { data, error } = await query
  if (error) fail(error)
  return (data || []).map(mapComplaint)
}

export async function fetchAdminMap() {
  const { data, error } = await client()
    .from('complaints')
    .select('id, code, lat, lng, status, priority, category, address, created_at, complaint_photos (kind, storage_path)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) fail(error)
  return (data || []).map((row) => {
    const photos = row.complaint_photos || []
    const thumb = photos.find((p) => p.kind === 'report') || photos[0]
    return {
      id: row.id,
      code: row.code,
      lat: row.lat,
      lng: row.lng,
      status: row.status,
      priority: row.priority,
      category: row.category,
      address: row.address,
      createdAt: row.created_at,
      thumbnail: photoUrl(thumb?.storage_path) || null,
    }
  })
}

export async function updateComplaint(id, patch = {}) {
  const { data, error } = await client().rpc('update_complaint', {
    p_id: id,
    p_status: patch.status ?? null,
    p_priority: patch.priority ?? null,
    p_assigned_to: patch.assignedTo ?? null,
    p_department: patch.department ?? null,
    p_resolution: patch.resolution ?? null,
    p_note: patch.note ?? null,
  })
  if (error) fail(error)
  if (!data?.ok) throw new Error(data?.error || 'Could not update the complaint.')
  dispatchEmails()
  return decorate(data.complaint)
}

export async function uploadComplaintPhotos(id, kind, files) {
  const db = client()
  const { data: userData } = await db.auth.getUser()
  const uid = userData?.user?.id
  if (!uid) throw new Error('Please sign in to continue.')

  const paths = await uploadPhotos(uid, files)
  const { data, error } = await db.rpc('add_complaint_photos', {
    p_id: id,
    p_kind: kind,
    p_paths: paths,
  })
  if (error) {
    await discardPhotos(paths)
    fail(error)
  }
  if (!data?.ok) throw new Error(data?.error || 'Could not attach the photos.')
  return decorate(data.complaint)
}

export async function fetchWorkers() {
  const { data, error } = await client().rpc('crew_summary')
  if (error) fail(error)
  return { workers: data?.workers || [], departments: data?.departments || [] }
}

export async function fetchMonthlyReport(month) {
  const { data, error } = await client().rpc('monthly_report', { p_month: month })
  if (error) fail(error)
  return data
}

export async function downloadReportCsv(month) {
  const report = await fetchMonthlyReport(month)
  const header = ['Complaint ID', 'Created', 'Category', 'Address', 'Priority', 'Status', 'Assigned to', 'Resolved']
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const lines = [
    header.join(','),
    ...report.rows.map((row) =>
      [row.code, row.createdAt, row.category, row.address, row.priority, row.status, row.assignedTo, row.resolvedAt]
        .map(escape)
        .join(','),
    ),
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = `cleancity-${report.month}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1500)
  return report
}
