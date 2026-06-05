"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { PwaRegister } from "@/components/pwa-register"

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideNav = pathname.startsWith("/plans/new")

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">{children}</main>
      {!hideNav && <BottomNav />}
      <PwaRegister />
    </div>
  )
}
