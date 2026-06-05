"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { CreatePlanInputDTO, ExerciseDTO } from "@my-progress/shared"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function NewPlanPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<ExerciseDTO[]>([])
  const [name, setName] = useState("Nuevo plan")
  const [selectedExerciseId, setSelectedExerciseId] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getExercises().then((items) => {
      setExercises(items)
      setSelectedExerciseId(items[0]?.id ?? "")
    }).catch(() => {})
  }, [])

  async function handleSubmit() {
    if (!selectedExerciseId) return
    const selectedExercise = exercises.find((item) => item.id === selectedExerciseId)
    if (!selectedExercise) return

    setSaving(true)
    const input: CreatePlanInputDTO = {
      name,
      startDate: new Date().toISOString(),
      status: "active",
      currentDay: 1,
      days: [
        {
          name: "Dia 1",
          order: 1,
          exercises: [
            {
              exerciseId: selectedExercise.id,
              exerciseName: selectedExercise.name,
              targetSets: 4,
              targetReps: 8,
              restSeconds: 90,
            },
          ],
        },
      ],
    }

    const plan = await api.createPlan(input)
    router.push(`/plans/${plan.id}`)
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Crear plan</h1>
        <p className="text-sm text-muted-foreground">La v1 crea un plan base editable desde el backend.</p>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <label className="text-sm font-medium">Nombre del plan</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <label className="text-sm font-medium">Primer ejercicio</label>
          <select
            value={selectedExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
            className="h-10 rounded-md bg-secondary px-3 text-sm"
          >
            {exercises.map((exercise) => (
              <option value={exercise.id} key={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
          <Button onClick={handleSubmit} disabled={saving || !selectedExerciseId}>
            {saving ? "Guardando..." : "Crear plan activo"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
