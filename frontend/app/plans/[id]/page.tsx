"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Play } from "lucide-react"
import type { PlanDTO } from "@my-progress/shared"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>()
  const [plan, setPlan] = useState<PlanDTO | null>(null)

  useEffect(() => {
    api.getPlan(params.id).then(setPlan).catch(() => {})
  }, [params.id])

  if (!plan) {
    return <p className="text-sm text-muted-foreground">Cargando plan...</p>
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{plan.name}</h1>
          <p className="text-sm text-muted-foreground">{plan.status} · {plan.totalDays} dias</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => api.activatePlan(plan.id).then(setPlan)}>
          <Play className="w-4 h-4" />
          Activar
        </Button>
      </div>
      {plan.days.map((day) => (
        <Card key={day.id}>
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{day.name}</h2>
              <span className="text-xs text-muted-foreground">Dia {day.order}</span>
            </div>
            <div className="flex flex-col gap-2">
              {day.exercises.map((exercise) => (
                <div key={exercise.id} className="rounded-xl bg-secondary/60 px-3 py-2">
                  <p className="text-sm font-medium">{exercise.exerciseName}</p>
                  <p className="text-xs text-muted-foreground">
                    {exercise.targetSets} x {exercise.targetReps} · descanso {exercise.restSeconds}s
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
