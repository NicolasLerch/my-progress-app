"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import type { HomeTodayDTO } from "@my-progress/shared"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"

interface AppBootContextValue {
  homeData: HomeTodayDTO | null
  homeError: string | null
  isHomeReady: boolean
}

const AppBootContext = createContext<AppBootContextValue | null>(null)

export function AppBootProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const pathname = usePathname()
  const [homeData, setHomeData] = useState<HomeTodayDTO | null>(null)
  const [homeError, setHomeError] = useState<string | null>(null)
  const [loadedHomeForUserId, setLoadedHomeForUserId] = useState<string | null>(null)
  const userId = session?.user.id
  const needsHomeData = Boolean(userId) && pathname === "/"
  const isHomeReady = !needsHomeData || loadedHomeForUserId === userId

  useEffect(() => {
    if (!needsHomeData || !userId) {
      return
    }

    let cancelled = false
    setHomeData(null)
    setHomeError(null)

    void api.getHome()
      .then((payload) => {
        if (!cancelled) {
          setHomeData(payload)
          setLoadedHomeForUserId(userId)
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) {
          setHomeError(cause.message)
          setLoadedHomeForUserId(userId)
        }
      })

    return () => {
      cancelled = true
    }
  }, [needsHomeData, userId])

  const value = useMemo(
    () => ({ homeData, homeError, isHomeReady }),
    [homeData, homeError, isHomeReady],
  )

  return <AppBootContext.Provider value={value}>{children}</AppBootContext.Provider>
}

export function useAppBoot() {
  const context = useContext(AppBootContext)

  if (!context) {
    throw new Error("useAppBoot must be used within an AppBootProvider")
  }

  return context
}
