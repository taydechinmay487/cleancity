/**
 * CleanCity edge worker.
 *
 * Serves the built SPA and drains the notification queue so citizens and
 * municipal staff get the email that goes with each in-app alert. Every data
 * operation happens directly between the browser and Supabase under row level
 * security; this worker only needs the service role to read the queue and the
 * mail provider key, neither of which ever reaches the browser.
 */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

async function verifyUser(request, env) {
  const header = request.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const user = await res.json().catch(() => null)
  return user?.id ? user : null
}

function rest(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

function markStatus(env, id, status) {
  return rest(env, `notifications?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ email_status: status }),
  })
}

/**
 * Email is sent through Resend over HTTPS (workers cannot open SMTP sockets).
 * Without RESEND_API_KEY the message is logged and recorded as "logged", so the
 * in-app notification still works and nothing pretends to have been delivered.
 */
async function sendEmail(env, { to, subject, text }) {
  if (!env.RESEND_API_KEY) {
    console.log(`[email:dev] to=${to} subject="${subject}"`)
    return 'logged'
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'CleanCity <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
  })

  if (!res.ok) {
    console.error('[email:failed]', res.status, (await res.text()).slice(0, 300))
    return 'failed'
  }
  return 'sent'
}

async function dispatchEmails(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Email delivery is not configured on this deployment.' }, 503)
  }

  const user = await verifyUser(request, env)
  if (!user) return json({ error: 'Sign in to continue.' }, 401)

  const profileRes = await rest(env, `profiles?id=eq.${user.id}&select=role`)
  const profile = (await profileRes.json().catch(() => []))[0]
  const isStaff = profile?.role === 'authority' || profile?.role === 'admin'

  const queueRes = await rest(
    env,
    'notifications?email_status=eq.pending&select=id,user_id,complaint_id,title,body,complaints(code)&order=created_at.asc&limit=25',
  )
  if (!queueRes.ok) return json({ error: 'Could not read the notification queue.' }, 502)

  let queue = await queueRes.json().catch(() => [])
  if (!Array.isArray(queue)) queue = []

  // A citizen may drain their own queue plus alerts for complaints they filed.
  // Municipal accounts drain everything.
  if (!isStaff && queue.length) {
    const ownRes = await rest(env, `complaints?select=id&user_id=eq.${user.id}&limit=200`)
    const own = await ownRes.json().catch(() => [])
    const ownIds = new Set((Array.isArray(own) ? own : []).map((row) => row.id))
    queue = queue.filter(
      (item) => item.user_id === user.id || (item.complaint_id && ownIds.has(item.complaint_id)),
    )
  }

  if (!queue.length) return json({ processed: 0, sent: 0, logged: 0, failed: 0, skipped: 0 })

  const userIds = [...new Set(queue.map((item) => item.user_id).filter(Boolean))]
  const peopleRes = await rest(env, `profiles?id=in.(${userIds.join(',')})&select=id,email`)
  const people = await peopleRes.json().catch(() => [])
  const emails = new Map((Array.isArray(people) ? people : []).map((row) => [row.id, row.email]))

  let sent = 0
  let logged = 0
  let failed = 0
  let skipped = 0

  for (const item of queue) {
    const to = emails.get(item.user_id)
    if (!to) {
      await markStatus(env, item.id, 'skipped')
      skipped += 1
      continue
    }

    const code = item.complaints?.code
    const text =
      code && env.APP_ORIGIN
        ? `${item.body}\n\nTrack this complaint: ${env.APP_ORIGIN}/track?code=${encodeURIComponent(code)}`
        : item.body

    const status = await sendEmail(env, { to, subject: item.title, text })
    if (status === 'sent') sent += 1
    else if (status === 'logged') logged += 1
    else failed += 1

    await markStatus(env, item.id, status)
  }

  return json({ processed: queue.length, sent, logged, failed, skipped })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'cleancity', time: new Date().toISOString() })
    }

    if (url.pathname === '/api/notify/dispatch') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
      return dispatchEmails(request, env)
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Unknown API route.' }, 404)
    }

    const response = await env.ASSETS.fetch(request)

    // Single page app: unknown paths render the client router.
    if (response.status === 404 && request.method === 'GET') {
      const index = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request))
      if (index.status === 200) {
        return new Response(index.body, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }
    }

    return response
  },
}
