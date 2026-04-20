import { supabase } from '@/app/lib/supabase'
import type { Profile } from '@/types/user'
import type { Session } from '@supabase/supabase-js'
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'

type AuthContextType = {
  session: Session | null | undefined;
  isLoading: boolean;
  profile: Profile | null | undefined;
  isLoggedIn: boolean;
  refetchProfile: () => Promise<void>;
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

  // Use ref to track current session to avoid stale closures
  const sessionRef = useRef<Session | null | undefined>(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Function to fetch profile - can be called manually to refresh
  // Use sessionRef to avoid stale closures and circular dependencies
  const fetchProfile = useCallback(async () => {
    // Always use latest session from ref to avoid stale closures
    const currentSession = sessionRef.current
    const sessionId = currentSession?.user?.id || null
    currentFetchSessionIdRef.current = sessionId
    
    setIsLoadingProfile(true)

    try {
      if (currentSession && sessionId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, settings')
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
          // Sync avatar_url from Google auth metadata if profile doesn't have one
          const googleAvatarUrl = currentSession.user.user_metadata?.avatar_url || currentSession.user.user_metadata?.picture
          const profileAvatarUrl = data?.avatar_url
          
          // If profile has no avatar but Google auth does, sync it
          if (googleAvatarUrl && !profileAvatarUrl) {
            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: googleAvatarUrl })
                .eq('id', sessionId)
              
              if (updateError) {
                console.error('Error syncing avatar from Google auth:', updateError)
              } else {
                // Update the profile data with the synced avatar
                data.avatar_url = googleAvatarUrl
              }
            } catch (syncErr) {
              console.error('Error syncing avatar:', syncErr)
            }
          }
          
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
  }, []) // Remove session dependency - use ref instead to break circular dependency

  // Manual refetch function exposed to consumers
  const refetchProfile = useCallback(async () => {
    const currentSession = sessionRef.current
    if (currentSession?.user?.id) {
      await fetchProfile()
    }
  }, [fetchProfile])

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
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (isActive && isMountedRef.current) {
            // Handle token refresh events
            if (event === 'TOKEN_REFRESHED' && session) {
              if (__DEV__) {
                console.log('Token refreshed successfully')
              }
              setSession(session)
            } 
            // Handle sign in events
            else if (event === 'SIGNED_IN' && session) {
              if (__DEV__) {
                console.log('User signed in')
              }
              setSession(session)
            }
            // Handle sign out events
            else if (event === 'SIGNED_OUT') {
              if (__DEV__) {
                console.log('User signed out')
              }
              setSession(null)
            }
            // Handle session updates
            else {
              setSession(session)
            }
          }
        })
        subscriptionRef.current = subscription
      } catch (subErr) {
        console.error('Error setting up auth state change subscription:', subErr)
        subscriptionRef.current = null
      }
    }

    // Fetch session asynchronously with refresh handling
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
          // Only kill session for actual auth errors, not network errors
          // Network errors should retry, not kill the session
          const isNetworkError = error.message?.includes('network') || 
                                 error.message?.includes('timeout') ||
                                 error.message?.includes('fetch');
          
          if (isNetworkError) {
            // Network error - retry with exponential backoff
            // Don't kill session on network errors, user might still be logged in
            const MAX_RETRIES = 3
            let retryCount = 0

            const attemptRetry = () => {
              if (!isActive || !isMountedRef.current || retryCount >= MAX_RETRIES) {
                if (isActive && isMountedRef.current) setIsLoadingSession(false)
                return
              }
              const delay = Math.min(1000 * Math.pow(2, retryCount), 8000) // 1s, 2s, 4s (max 8s)
              retryCount++
              timeoutId = setTimeout(async () => {
                if (!isActive || !isMountedRef.current) return
                try {
                  const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession()
                  if (!retryError && retrySession) {
                    setSession(retrySession)
                    setIsLoadingSession(false)
                  } else if (!retryError && !retrySession) {
                    setSession(null)
                    setIsLoadingSession(false)
                  } else {
                    attemptRetry() // Retry again
                  }
                } catch (retryErr) {
                  console.error('Retry session fetch failed:', retryErr)
                  attemptRetry() // Retry again
                }
              }, delay)
            }

            attemptRetry()
            return
          }
          
          // Actual auth error (expired/invalid token) - try to refresh
          if (error.message?.includes('expired') || error.message?.includes('invalid')) {
            try {
              const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
              if (!refreshError && refreshedSession) {
                if (__DEV__) {
                  console.log('Session refreshed successfully')
                }
                setSession(refreshedSession)
                setIsLoadingSession(false)
                return
              }
            } catch (refreshErr) {
              console.error('Error refreshing session:', refreshErr)
            }
          }
          
          // Only set session to null if it's a real auth error (not network)
          // This prevents killing valid sessions on temporary network issues
          setSession(null)
        } else {
          // Set session immediately - let Supabase handle token refresh automatically
          // Don't proactively refresh here as it adds delay to startup
          setSession(session)
        }
        setIsLoadingSession(false)
      } catch (err) {
        if (!isActive || !isMountedRef.current) return
        console.error('Error fetching auth session:', err)
        setIsLoadingSession(false)
        setSession(null)
      }
    }

    // Initialize subscription immediately (synchronously)
    initializeSubscription()

    // Fetch session immediately (no delay)
    if (isActive) {
      fetchSession()
    }

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
  // Must include session so we refetch when user logs in (fetchProfile uses sessionRef)
  useEffect(() => {
    fetchProfile()

    // Cleanup: mark that this fetch is no longer valid
    return () => {
      currentFetchSessionIdRef.current = null
    }
  }, [session, fetchProfile])

  // Handle app state changes to refresh session when app comes to foreground
  // Only refresh if session exists and app was in background for a while
  useEffect(() => {
    let appStateSubscription: { remove: () => void } | null = null
    let backgroundTime: number | null = null

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundTime = Date.now()
          } else if (nextAppState === 'active' && session && backgroundTime) {
            // Only refresh if app was in background for more than 5 minutes
            const timeInBackground = Date.now() - backgroundTime
            if (timeInBackground > 5 * 60 * 1000) {
              try {
                // Quick check - don't wait for refresh if it's slow
                const { data: { session: currentSession } } = await Promise.race([
                  supabase.auth.getSession(),
                  new Promise<{ data: { session: null } }>((resolve) => 
                    setTimeout(() => resolve({ data: { session: null } }), 1000)
                  )
                ])
                
                if (currentSession) {
                  setSession(currentSession)
                }
          } catch (err) {
            // Silently fail - session will refresh automatically when needed
            console.error('Error refreshing session on app state change:', err)
          }
        }
        backgroundTime = null
      }
    }

    // Subscribe to app state changes
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      if (appStateSubscription) {
        appStateSubscription.remove()
      }
    }
  }, [session])

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        profile,
        isLoggedIn: session !== undefined && session !== null,
        refetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}