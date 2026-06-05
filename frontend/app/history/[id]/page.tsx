"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import type { WorkoutSessionDTO } from "@my-progress/shared"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>()
  const [session, setSession] = useState<WorkoutSessionDTO | null>(null)

  useEffect(() => {
    api.getHistorySession(params.id).then(setSession).catch(() => {})
  }, [params.id])

  if (!session) {
    return <p className="text-sm text-muted-foreground">Cargando sesion...</p>
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">{session.dayName}</h1>
        <p className="text-sm text-muted-foreground">{new Date(session.date).toLocaleDateString("es-AR")} · {session.planName}</p>
      </div>
      {session.exercises.map((exercise) => (
        <Card key={exercise.id}>
          <CardContent className="p-4 flex flex-col gap-2">
            <h2 className="font-semibold">{exercise.exerciseName}</h2>
            {exercise.sets.map((set) => (
              <div key={set.id} className="rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                Serie {set.setNumber}: {set.weight}kg x {set.reps}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
