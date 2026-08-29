"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { AppBootProvider, useAppBoot } from "@/components/app-boot-provider"
import { AppSplashScreen } from "@/components/app-splash-screen"
import { AuthScreen } from "@/components/auth-screen"
import { useAuth } from "@/lib/auth"

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <AppBootProvider>
      <AuthGateContent>{children}</AuthGateContent>
    </AppBootProvider>
  )
}

function AuthGateContent({ children }: { children: ReactNode }) {
  const { isLoading, session } = useAuth()
  const { isHomeReady } = useAppBoot()
  const [minimumDurationReached, setMinimumDurationReached] = useState(false)
  const [isSplashVisible, setIsSplashVisible] = useState(true)
  const [isSplashExiting, setIsSplashExiting] = useState(false)
  const [splashCycle, setSplashCycle] = useState(0)
  const previousUserIdRef = useRef<string | null>(null)
  const userId = session?.user.id ?? null

  useEffect(() => {
    const minimumDurationTimer = window.setTimeout(() => {
      setMinimumDurationReached(true)
    }, 1100)

    return () => window.clearTimeout(minimumDurationTimer)
  }, [splashCycle])

  useEffect(() => {
    if (!isLoading && previousUserIdRef.current === null && userId !== null) {
      setMinimumDurationReached(false)
      setIsSplashVisible(true)
      setIsSplashExiting(false)
      setSplashCycle((currentCycle) => currentCycle + 1)
    }

    previousUserIdRef.current = userId
  }, [isLoading, userId])

  useEffect(() => {
    if (isLoading || !minimumDurationReached || (session && !isHomeReady) || isSplashExiting || !isSplashVisible) {
      return
    }

    setIsSplashExiting(true)
  }, [isHomeReady, isLoading, isSplashExiting, isSplashVisible, minimumDurationReached, session])

  useEffect(() => {
    if (!isSplashExiting) {
      return
    }

    const exitTimer = window.setTimeout(() => {
      setIsSplashVisible(false)
    }, 650)

    return () => window.clearTimeout(exitTimer)
  }, [isSplashExiting])

  if (isLoading || isSplashVisible) {
    return (
      <>
        {!isLoading && (session ? children : <AuthScreen />)}
        <AppSplashScreen key={splashCycle} isExiting={isSplashExiting} />
      </>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return <>{children}</>
}
