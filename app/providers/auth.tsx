import { supabase } from '@/app/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'

export const AuthContext = createContext<any>(undefined)

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined){
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

export default function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | undefined | null>()
  const [profile, setProfile] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Fetch the session once, and subscribe to auth state changes
  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true)

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      setSession(session)
      setIsLoading(false)
    }

    fetchSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Fetch the profile when the session changes
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true)

      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setProfile(data)
      } else {
        setProfile(null)
      }

      setIsLoading(false)
    }

    fetchProfile()
  }, [session])

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        profile,
        isLoggedIn: session != undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}