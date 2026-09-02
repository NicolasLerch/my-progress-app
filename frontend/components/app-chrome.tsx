"use client"

import { usePathname } from "next/navigation"
import { AuthGate } from "@/components/auth-gate"
import { BottomNav } from "@/components/bottom-nav"
import { PwaRegister } from "@/components/pwa-register"
import { useAuth } from "@/lib/auth"

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { session } = useAuth()
  const hideNav = !session || pathname.startsWith("/plans/new")

  return (
    <AuthGate>
      <div className="min-h-screen bg-background">
        <main className="mx-auto w-full max-w-lg px-3 pt-6 pb-24">
          {children}
        </main>
        {!hideNav && <BottomNav />}
        <PwaRegister />
      </div>
    </AuthGate>
  )
}
