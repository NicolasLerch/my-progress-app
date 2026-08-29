"use client"

import { useEffect, useState, type ReactNode } from "react"
import { AppSplashScreen } from "@/components/app-splash-screen"
import { AuthScreen } from "@/components/auth-screen"
import { useAuth } from "@/lib/auth"

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, session } = useAuth()
  const [minimumDurationReached, setMinimumDurationReached] = useState(false)
  const [isSplashVisible, setIsSplashVisible] = useState(true)
  const [isSplashExiting, setIsSplashExiting] = useState(false)

  useEffect(() => {
    const minimumDurationTimer = window.setTimeout(() => {
      setMinimumDurationReached(true)
    }, 1100)

    return () => window.clearTimeout(minimumDurationTimer)
  }, [])

  useEffect(() => {
    if (isLoading || !minimumDurationReached || isSplashExiting || !isSplashVisible) {
      return
    }

    setIsSplashExiting(true)
    const exitTimer = window.setTimeout(() => {
      setIsSplashVisible(false)
    }, 650)

    return () => window.clearTimeout(exitTimer)
  }, [isLoading, isSplashExiting, isSplashVisible, minimumDurationReached])

  if (isLoading || isSplashVisible) {
    return <AppSplashScreen isExiting={isSplashExiting} />
  }

  if (!session) {
    return <AuthScreen />
  }

  return <>{children}</>
}
