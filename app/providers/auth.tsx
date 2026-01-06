import { supabase } from '@/app/lib/supabase'
import type { Profile } from '@/types/user'
import type { Session } from '@supabase/supabase-js'
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react'

type AuthContextType = {
  session: Session | null | undefined;
  isLoading: boolean;
  profile: Profile | null | undefined;
  isLoggedIn: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

export default function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | undefined | null>()
  const [profile, setProfile] = useState<Profile | null | undefined>(null)
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true)
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false)
  
  // Use ref to track if component is mounted and the current session being fetched
  const isMountedRef = useRef(true)
  const currentFetchSessionIdRef = useRef<string | null>(null)

  // Combined loading state - true if either session or profile is loading
  const isLoading = isLoadingSession || isLoadingProfile

  // Fetch the session once, and subscribe to auth state changes
  useEffect(() => {
    const fetchSession = async () => {
      setIsLoadingSession(true)

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()
      
      if (!isMountedRef.current) return
      
      if (error) {
        console.error('Error fetching auth session:', error)
      }
      setSession(session)
      setIsLoadingSession(false)
    }

    fetchSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMountedRef.current) {
        setSession(session)
      }
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
      isMountedRef.current = false
    }
  }, [])

  // Fetch the profile when the session changes
  useEffect(() => {
    const fetchProfile = async () => {
      // Track which session we're fetching for
      const sessionId = session?.user?.id || null
      currentFetchSessionIdRef.current = sessionId
      
      setIsLoadingProfile(true)

      try {
        if (session && sessionId) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionId)
            .single()
          
          // Check if this fetch is still valid (session hasn't changed)
          if (!isMountedRef.current || currentFetchSessionIdRef.current !== sessionId) {
            return
          }
          
          if (error) {
            console.error('Error fetching user profile:', error)
            setProfile(null)
          } else {
            setProfile(data as Profile)
          }
        } else {
          setProfile(null)
        }
      } catch (err) {
        // Only handle errors if this fetch is still valid
        if (!isMountedRef.current || currentFetchSessionIdRef.current !== sessionId) {
          return
        }
        
        console.error('Unexpected error while fetching user profile:', err)
        setProfile(null)
      } finally {
        // Only update loading state if this fetch is still valid
        if (isMountedRef.current && currentFetchSessionIdRef.current === sessionId) {
          setIsLoadingProfile(false)
        }
      }
    }

    fetchProfile()

    // Cleanup: mark that this fetch is no longer valid
    return () => {
      currentFetchSessionIdRef.current = null
    }
  }, [session])

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        profile,
        isLoggedIn: session !== undefined && session !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}