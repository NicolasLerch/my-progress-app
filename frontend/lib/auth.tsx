"use client"

import {
  createContext,
  useRef,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface SignUpInput {
  email: string
  password: string
  name: string
  lastName?: string
  birthDate?: string
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isInvalidRefreshTokenError(error: unknown) {
  return error instanceof Error && error.message.includes("Invalid Refresh Token")
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const suppressTransientSessionRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function bootstrapSession() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          throw error
        }

        const nextSession = data.session ?? null
        if (!nextSession) {
          if (mounted) {
            setSession(null)
          }
          return
        }

        const { data: userData, error: userError } = await supabase.auth.getUser(nextSession.access_token)
        if (userError || !userData.user) {
          await supabase.auth.signOut({ scope: "local" })

          if (mounted) {
            setSession(null)
          }
          return
        }

        if (mounted) {
          setSession(nextSession)
        }
      } catch (error) {
        if (!isInvalidRefreshTokenError(error)) {
          console.error("Failed to load Supabase session", error)
        }
        await supabase.auth.signOut({ scope: "local" })

        if (mounted) {
          setSession(null)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void bootstrapSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return

      if (suppressTransientSessionRef.current && nextSession) {
        return
      }

      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          throw error
        }
      },
      async signUp(input) {
        suppressTransientSessionRef.current = true

        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: {
              name: input.name,
              lastName: input.lastName,
              birthDate: input.birthDate,
            },
          },
        })

        if (error) {
          suppressTransientSessionRef.current = false
          throw error
        }

        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut()
          if (signOutError) {
            suppressTransientSessionRef.current = false
            throw signOutError
          }
        }

        suppressTransientSessionRef.current = false
      },
      async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) {
          throw error
        }
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          throw error
        }
      },
    }),
    [isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
