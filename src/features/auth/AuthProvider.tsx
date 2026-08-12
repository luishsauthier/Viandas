import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { isValidPin, normalizePhoneToE164, phoneToAuthEmail } from '@/lib/phone'
import type { Profile } from '@/types'
import { invokeActivateUser, invokeBootstrapAdmin } from '@/features/auth/api'

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  signInWithPhonePin: (phone: string, pin: string) => Promise<Profile>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
  bootstrapAdmin: (input: {
    name: string
    phone: string
    pin: string
    is_participant?: boolean
  }) => Promise<Profile>
  activateWithToken: (input: { token: string; pin: string; pinConfirm: string }) => Promise<Profile>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(() => Boolean(supabase))

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      setProfile(null)
      return null
    }
    const client = supabase
    const {
      data: { session: current },
    } = await client.auth.getSession()
    if (!current?.user) {
      setProfile(null)
      return null
    }
    const nextProfile = await fetchProfile(current.user.id)
    if (nextProfile && !nextProfile.is_active) {
      await client.auth.signOut()
      setSession(null)
      setProfile(null)
      throw new Error('Funcionário inativo. Fale com o administrador.')
    }
    setProfile(nextProfile)
    return nextProfile
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client) return

    let mounted = true

    void client.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        try {
          const nextProfile = await fetchProfile(data.session.user.id)
          if (!mounted) return
          if (nextProfile && !nextProfile.is_active) {
            await client.auth.signOut()
            setSession(null)
            setProfile(null)
          } else {
            setProfile(nextProfile)
          }
        } catch {
          if (mounted) setProfile(null)
        }
      }
      if (mounted) setLoading(false)
    })

    const { data: subscription } = client.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession?.user) {
        setProfile(null)
        return
      }
      try {
        const nextProfile = await fetchProfile(nextSession.user.id)
        setProfile(nextProfile)
      } catch {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signInWithPhonePin = useCallback(
    async (phone: string, pin: string) => {
      if (!supabase) throw new Error('Supabase não configurado')
      if (!isValidPin(pin)) throw new Error('PIN deve ter 6 dígitos')
      const e164 = normalizePhoneToE164(phone)
      const email = phoneToAuthEmail(e164)
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
      if (error) {
        throw new Error('Telefone ou PIN inválidos')
      }
      const nextProfile = await refreshProfile()
      if (!nextProfile) {
        await supabase.auth.signOut()
        throw new Error('Perfil não encontrado')
      }
      if (!nextProfile.activated_at) {
        await supabase.auth.signOut()
        throw new Error('Conta ainda não ativada. Use o link de convite.')
      }
      return nextProfile
    },
    [refreshProfile],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const bootstrapAdmin = useCallback(
    async (input: { name: string; phone: string; pin: string; is_participant?: boolean }) => {
      if (!supabase) throw new Error('Supabase não configurado')
      const result = await invokeBootstrapAdmin(input)
      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        })
        const nextProfile = await refreshProfile()
        if (!nextProfile) throw new Error('Perfil não encontrado')
        return nextProfile
      }
      return signInWithPhonePin(input.phone, input.pin)
    },
    [refreshProfile, signInWithPhonePin],
  )

  const activateWithToken = useCallback(
    async (input: { token: string; pin: string; pinConfirm: string }) => {
      if (!supabase) throw new Error('Supabase não configurado')
      const result = await invokeActivateUser(input)
      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        })
        const nextProfile = await refreshProfile()
        if (!nextProfile) throw new Error('Perfil não encontrado')
        return nextProfile
      }
      throw new Error('Ativação concluída. Faça login com telefone e PIN.')
    },
    [refreshProfile],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      isAuthenticated: Boolean(session && profile),
      isAdmin: profile?.role === 'admin',
      signInWithPhonePin,
      signOut,
      refreshProfile,
      bootstrapAdmin,
      activateWithToken,
    }),
    [
      session,
      profile,
      loading,
      signInWithPhonePin,
      signOut,
      refreshProfile,
      bootstrapAdmin,
      activateWithToken,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
