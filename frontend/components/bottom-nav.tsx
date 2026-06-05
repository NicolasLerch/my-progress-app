"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Dumbbell, TrendingUp, Calendar, History } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/", label: "Inicio", icon: Home, match: (pathname: string) => pathname === "/" },
  { href: "/training/current", label: "Entreno", icon: Dumbbell, match: (pathname: string) => pathname.startsWith("/training") },
  { href: "/progress", label: "Progreso", icon: TrendingUp, match: (pathname: string) => pathname.startsWith("/progress") },
  { href: "/plans", label: "Planes", icon: Calendar, match: (pathname: string) => pathname.startsWith("/plans") },
  { href: "/history", label: "Historial", icon: History, match: (pathname: string) => pathname.startsWith("/history") },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.match(pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
              <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
