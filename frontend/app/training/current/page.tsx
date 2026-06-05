"use client"

import { useEffect, useMemo, useState } from "react"
import type { HomeTodayDTO, WorkoutSessionDTO, WorkoutSetInputDTO } from "@my-progress/shared"
import { api } from "@/lib/api"
import {
  deleteSessionSnapshot,
  getSessionSnapshot,
  listSetOperations,
  queueSetOperation,
  removeSetOperation,
  saveSessionSnapshot,
} from "@/lib/offline-workouts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function TrainingCurrentPage() {
  const [home, setHome] = useState<HomeTodayDTO | null>(null)
  const [session, setSession] = useState<WorkoutSessionDTO | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    api.getHome().then(async (payload) => {
      setHome(payload)
      const currentSession = payload.currentSession
      if (currentSession) {
        const snapshot = await getSessionSnapshot(currentSession.id)
        setSession(snapshot ?? currentSession)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!session) return
    void flushQueue(session.id)
  }, [session?.id])

  async function startWorkout() {
    if (!home?.activePlan || !home.todayDay) {
      return
    }

    const created = await api.createWorkoutSession({
      planId: home.activePlan.id,
      planDayId: home.todayDay.id,
      date: new Date().toISOString(),
    })
    await saveSessionSnapshot(created)
    setSession(created)
  }

  async function flushQueue(sessionId: string) {
    if (!navigator.onLine) return
    const operations = await listSetOperations(sessionId)
    for (const operation of operations) {
      try {
        await api.upsertWorkoutSet(operation.sessionId, operation.exerciseId, operation.payload)
        await removeSetOperation(operation.id)
      } catch {
        return
      }
    }
  }

  async function saveSet(exerciseId: string, setNumber: number, weight: number, reps: number) {
    if (!session) return
    const payload: WorkoutSetInputDTO = {
      setNumber,
      weight,
      reps,
      updatedAt: new Date().toISOString(),
    }

    const nextSession: WorkoutSessionDTO = {
      ...session,
      exercises: session.exercises.map((exercise) =>
        exercise.exerciseId === exerciseId
          ? {
              ...exercise,
              sets: [
                ...exercise.sets.filter((item) => item.setNumber !== setNumber),
                {
                  id: `${exercise.id}-${setNumber}`,
                  workoutExerciseId: exercise.id,
                  setNumber,
                  weight,
                  reps,
                  createdAt: payload.updatedAt,
                  updatedAt: payload.updatedAt,
                },
              ].sort((a, b) => a.setNumber - b.setNumber),
            }
          : exercise,
      ),
    }

    setSession(nextSession)
    await saveSessionSnapshot(nextSession)
    await queueSetOperation(session.id, exerciseId, payload)
    setPending(true)

    try {
      const synced = await api.upsertWorkoutSet(session.id, exerciseId, payload)
      await saveSessionSnapshot(synced)
      setSession(synced)
      await removeSetOperation(`${session.id}-${exerciseId}-${setNumber}`)
    } catch {
      // Keep the queued operation to retry later when connectivity is restored.
    } finally {
      setPending(false)
    }
  }

  async function completeWorkout() {
    if (!session) return
    const completed = await api.completeWorkoutSession(session.id)
    setSession(completed)
    await deleteSessionSnapshot(session.id)
  }

  const totalCompletedSets = useMemo(
    () => session?.exercises.reduce((count, exercise) => count + exercise.sets.length, 0) ?? 0,
    [session],
  )

  if (!home) {
    return <p className="text-sm text-muted-foreground">Cargando entrenamiento...</p>
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold">{home.todayDay?.name ?? "Sin entrenamiento"}</h1>
          <p className="text-sm text-muted-foreground">{home.activePlan?.name ?? "Activa un plan para entrenar"}</p>
        </div>
        <Button disabled={!home.todayDay} onClick={startWorkout}>
          Iniciar sesion de hoy
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">{session.dayName}</h1>
        <p className="text-sm text-muted-foreground">
          {session.planName} · {totalCompletedSets} series guardadas {pending ? "· sincronizando..." : ""}
        </p>
      </div>
      {session.exercises.map((exercise) => (
        <ExerciseCard key={exercise.id} session={session} exerciseId={exercise.exerciseId} title={exercise.exerciseName} target={`${exercise.targetSets} x ${exercise.targetReps}`} onSave={saveSet} />
      ))}
      <Button onClick={completeWorkout}>Finalizar entrenamiento</Button>
    </div>
  )
}

function ExerciseCard({
  session,
  exerciseId,
  title,
  target,
  onSave,
}: {
  session: WorkoutSessionDTO
  exerciseId: string
  title: string
  target: string
  onSave: (exerciseId: string, setNumber: number, weight: number, reps: number) => Promise<void>
}) {
  const exercise = session.exercises.find((item) => item.exerciseId === exerciseId)
  const nextSetNumber = (exercise?.sets.length ?? 0) + 1
  const [weight, setWeight] = useState("")
  const [reps, setReps] = useState("")

  if (!exercise) return null

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{target}</p>
          </div>
          <span className="text-xs text-primary">Serie {nextSetNumber}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Peso" value={weight} onChange={(event) => setWeight(event.target.value)} />
          <Input type="number" placeholder="Reps" value={reps} onChange={(event) => setReps(event.target.value)} />
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await onSave(exerciseId, nextSetNumber, Number(weight), Number(reps))
            setWeight("")
            setReps("")
          }}
          disabled={!weight || !reps}
        >
          Guardar serie
        </Button>
        <div className="flex flex-col gap-2">
          {exercise.sets.map((set) => (
            <div key={set.id} className="rounded-xl bg-secondary/60 px-3 py-2 text-sm">
              Serie {set.setNumber}: {set.weight}kg x {set.reps}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
