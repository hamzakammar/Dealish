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
  // ALL hooks MUST be called unconditionally at the top level
  const [session, setSession] = useState<Session | undefined | null>(undefined)
  const [profile, setProfile] = useState<Profile | null | undefined>(null)
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true)
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false)
  
  // Use ref to track if component is mounted and the current session being fetched
  const isMountedRef = useRef(true)
  const currentFetchSessionIdRef = useRef<string | null>(null)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  // Combined loading state - true if either session or profile is loading
  const isLoading = isLoadingSession || isLoadingProfile

  // Fetch the session once, and subscribe to auth state changes
  // This effect MUST always run to maintain hook consistency
  useEffect(() => {
    let isActive = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Always initialize subscription synchronously to maintain hook consistency
    // This ensures the hook structure is always the same, even if it fails
    const initializeSubscription = () => {
      try {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (isActive && isMountedRef.current) {
            setSession(session)
          }
        })
        subscriptionRef.current = subscription
      } catch (subErr) {
        console.error('Error setting up auth state change subscription:', subErr)
        subscriptionRef.current = null
      }
    }

    // Fetch session asynchronously
    const fetchSession = async () => {
      if (!isActive) return
      
      try {
        setIsLoadingSession(true)

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        
        if (!isActive || !isMountedRef.current) return
        
        if (error) {
          console.error('Error fetching auth session:', error)
        }
        setSession(session)
        setIsLoadingSession(false)
      } catch (err) {
        if (!isActive || !isMountedRef.current) return
        console.error('Error fetching auth session:', err)
        setIsLoadingSession(false)
      }
    }

    // Initialize subscription immediately (synchronously)
    initializeSubscription()

    // Fetch session after a tiny delay to ensure mount is complete
    timeoutId = setTimeout(() => {
      if (isActive) {
        fetchSession()
      }
    }, 0)

    // Always return cleanup function for consistent hook structure
    return () => {
      isActive = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe()
        } catch (err) {
          // Ignore cleanup errors
        }
        subscriptionRef.current = null
      }
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