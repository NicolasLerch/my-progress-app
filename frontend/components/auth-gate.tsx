"use client"

import type { ReactNode } from "react"
import { LoaderCircle } from "lucide-react"
import { AuthScreen } from "@/components/auth-screen"
import { useAuth } from "@/lib/auth"

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, session } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <LoaderCircle className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando sesión...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return <>{children}</>
}
