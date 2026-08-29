"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Calendar, ChevronRight, Plus } from "lucide-react"
import type { PlanDTO } from "@my-progress/shared"
import { AppLoadingIndicator } from "@/components/app-loading-indicator"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { api } from "@/lib/api"

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanDTO[]>([])
  const { isLoading, isReady, session } = useAuthReady()

  useEffect(() => {
    if (!isReady) return
    api.getPlans().then(setPlans).catch(() => {})
  }, [isReady])

  useEffect(() => {
    if (!session) {
      setPlans([])
    }
  }, [session])

  if (isLoading) {
    return <AppLoadingIndicator label="Verificando sesión..." />
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Tus planes</h1>
          <p className="text-sm text-muted-foreground">Gestiona rutinas y dias activos</p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/plans/new">
            <Plus className="w-4 h-4" />
            Nuevo
          </Link>
        </Button>
      </div>

      {plans.map((plan) => (
        <Link href={`/plans/${plan.id}`} key={plan.id}>
          <Card className="border-border/50 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{plan.name}</h2>
                  <Badge variant="outline">{plan.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{plan.totalDays} dias · inicio {new Date(plan.startDate).toLocaleDateString("es-AR")}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
