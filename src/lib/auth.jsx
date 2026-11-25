import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from './supabase.js'

const AuthContext = createContext(null)

async function loadProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role, department')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    let alive = true

    const apply = async (session) => {
      const profile = session?.user ? await loadProfile(session.user.id) : null
      if (!alive) return
      setUser(profile)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      // Deferred so Supabase can finish its own auth callback without deadlock.
      setTimeout(() => apply(session), 0)
    })

    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async ({ email, password, portal }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || ''),
    })
    if (error) {
      throw new Error(
        /invalid login credentials/i.test(error.message)
          ? 'Email or password is incorrect.'
          : error.message,
      )
    }

    const profile = await loadProfile(data.user?.id)
    if (!profile) {
      await supabase.auth.signOut()
      throw new Error('This account has no profile yet. Please contact the administrator.')
    }
    if (portal === 'authority' && profile.role === 'citizen') {
      await supabase.auth.signOut()
      setUser(null)
      throw new Error('This account does not have authority access.')
    }
    if (portal === 'citizen' && profile.role !== 'citizen') {
      await supabase.auth.signOut()
      setUser(null)
      throw new Error('Staff accounts sign in through the authority portal.')
    }

    setUser(profile)
    return profile
  }, [])

  const register = useCallback(async ({ name, email, password, phone }) => {
    const { data, error } = await supabase.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: { data: { name: String(name || '').trim(), phone: String(phone || '').trim() } },
    })
    if (error) throw new Error(error.message)
    if (!data.session) {
      throw new Error('Account created. Check your email to confirm the address, then sign in.')
    }

    let profile = await loadProfile(data.user?.id)
    if (!profile) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      profile = await loadProfile(data.user?.id)
    }
    const account = profile || { id: data.user?.id, name, email, role: 'citizen', department: null }
    setUser(account)
    return account
  }, [])

  const registerAuthority = useCallback(async ({ name, email, password, department, inviteCode }) => {
    const { data: allowed, error: inviteError } = await supabase.rpc('check_authority_invite', {
      invite_code: String(inviteCode || '').trim(),
    })
    if (inviteError) throw new Error(inviteError.message)
    if (!allowed) throw new Error('Invalid authority invite code.')

    const { data, error } = await supabase.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: { data: { name: String(name || '').trim() } },
    })
    if (error) throw new Error(error.message)
    if (!data.session) {
      throw new Error(
        'Account created. Confirm your email, then sign in and use the invite code again to activate authority access.',
      )
    }

    const { data: claimed, error: claimError } = await supabase.rpc('claim_authority', {
      invite_code: String(inviteCode || '').trim(),
      dept: String(department || '').trim() || null,
    })
    if (claimError) throw new Error(claimError.message)
    if (!claimed?.ok) throw new Error(claimed?.error || 'Could not activate authority access.')

    const profile = await loadProfile(data.user?.id)
    if (!profile) throw new Error('Authority account created, but the profile could not be loaded.')
    setUser(profile)
    return profile
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      isStaff: user?.role === 'authority' || user?.role === 'admin',
      login,
      register,
      registerAuthority,
      logout,
      setUser,
    }),
    [user, loading, login, register, registerAuthority, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
