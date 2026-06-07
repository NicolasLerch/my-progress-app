"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { ExerciseDTO, HomeTodayDTO, WorkoutSessionDTO, WorkoutSetInputDTO } from "@my-progress/shared"
import { api } from "@/lib/api"
import {
  deleteSessionSnapshot,
  getSessionSnapshot,
  listSetOperations,
  queueSetOperation,
  removeSetOperation,
  saveSessionSnapshot,
} from "@/lib/offline-workouts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"

function isPlanlessSession(session: WorkoutSessionDTO | null) {
  return Boolean(session && !session.planId)
}

export default function TrainingCurrentPage() {
  const router = useRouter()
  const [home, setHome] = useState<HomeTodayDTO | null>(null)
  const [session, setSession] = useState<WorkoutSessionDTO | null>(null)
  const [exercises, setExercises] = useState<ExerciseDTO[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState("")
  const [selectedPlanDayId, setSelectedPlanDayId] = useState("")
  const [pending, setPending] = useState(false)
  const [creatingExercise, setCreatingExercise] = useState(false)
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null)
  const [completedDialogOpen, setCompletedDialogOpen] = useState(false)
  const [completingWorkout, setCompletingWorkout] = useState(false)
  const [cancellingWorkout, setCancellingWorkout] = useState(false)

  useEffect(() => {
    api.getHome().then(async (payload) => {
      setHome(payload)
      setSelectedPlanDayId(payload.todayDay?.id ?? payload.activePlan?.days[0]?.id ?? "")
      const currentSession = payload.currentSession
      if (currentSession) {
        const snapshot = await getSessionSnapshot(currentSession.id)
        setSession(snapshot ?? currentSession)
      }
    }).catch(() => {})

    api.getExercises().then((items) => {
      setExercises(items)
      setSelectedExerciseId(items[0]?.id ?? "")
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!session) return
    void flushQueue(session.id)
  }, [session?.id])

  async function startWorkout(planDayId?: string) {
    if (!home?.activePlan) {
      return
    }
    const selectedDay = home.activePlan.days.find((day) => day.id === (planDayId ?? selectedPlanDayId))
    if (!selectedDay) return

    const created = await api.createWorkoutSession({
      planId: home.activePlan.id,
      planDayId: selectedDay.id,
      date: new Date().toISOString(),
    })
    await saveSessionSnapshot(created)
    setSession(created)
  }

  async function startPlanlessWorkout() {
    const created = await api.createWorkoutSession({
      mode: "planless",
      date: new Date().toISOString(),
    })
    await saveSessionSnapshot(created)
    setSession(created)
  }

  async function addExerciseToSession() {
    if (!session || !selectedExerciseId) {
      return
    }

    setCreatingExercise(true)

    try {
      const updated = await api.addWorkoutExercise(session.id, { exerciseId: selectedExerciseId })
      await saveSessionSnapshot(updated)
      setSession(updated)
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "No se pudo agregar el ejercicio",
        description: cause instanceof Error ? cause.message : "Ocurrio un error inesperado.",
      })
    } finally {
      setCreatingExercise(false)
    }
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
    setCompletingWorkout(true)

    try {
      const completed = await api.completeWorkoutSession(session.id)
      setSession(completed)
      setCompletedSessionId(completed.id)
      setCompletedDialogOpen(true)
      await deleteSessionSnapshot(session.id)
      setConfirmCompleteOpen(false)
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "No se pudo finalizar el entrenamiento",
        description: cause instanceof Error ? cause.message : "Ocurrio un error inesperado.",
      })
    } finally {
      setCompletingWorkout(false)
    }
  }

  async function cancelWorkout() {
    if (!session) return
    setCancellingWorkout(true)

    try {
      await api.updateWorkoutSession(session.id, { status: "abandoned" })
      await deleteSessionSnapshot(session.id)
      setConfirmCancelOpen(false)
      router.push("/")
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "No se pudo cancelar la sesion",
        description: cause instanceof Error ? cause.message : "Ocurrio un error inesperado.",
      })
    } finally {
      setCancellingWorkout(false)
    }
  }

  const totalCompletedSets = useMemo(
    () => session?.exercises.reduce((count, exercise) => count + exercise.sets.length, 0) ?? 0,
    [session],
  )

  if (!home) {
    return <p className="text-sm text-muted-foreground">Cargando entrenamiento...</p>
  }

  if (!session) {
    const selectedPlanDay = home.activePlan?.days.find((day) => day.id === selectedPlanDayId)

    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold">{home.todayDay?.name ?? "Entrenamiento libre"}</h1>
          <p className="text-sm text-muted-foreground">
            {home.activePlan?.name ?? "No tienes un plan activo. Puedes entrenar sin plan."}
          </p>
        </div>
        {home.activePlan && (
          <Card>
            <CardContent className="p-4 flex flex-col gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Dia correspondiente</p>
                <p className="text-sm font-medium">{home.todayDay?.name ?? home.activePlan.days[0]?.name}</p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">O elegir otro dia del plan</label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedPlanDayId}
                  onChange={(event) => setSelectedPlanDayId(event.target.value)}
                >
                  {home.activePlan.days.map((day) => (
                    <option key={day.id} value={day.id}>
                      {day.order}. {day.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={() => startWorkout(selectedPlanDayId)} disabled={!selectedPlanDay}>
                {selectedPlanDay?.id === home.todayDay?.id
                  ? `Continuar con ${home.todayDay?.name}`
                  : `Continuar con ${selectedPlanDay?.name ?? "otro dia"}`}
              </Button>
            </CardContent>
          </Card>
        )}
        <Button variant="outline" onClick={startPlanlessWorkout}>
          Iniciar entrenamiento libre
        </Button>
      </div>
    )
  }

  const planless = isPlanlessSession(session)

  return (
    <>
      <div className="flex flex-col gap-4 pb-4">
        <div>
          <h1 className="text-xl font-bold">{session.dayName}</h1>
          <p className="text-sm text-muted-foreground">
            {session.planName} · {totalCompletedSets} series guardadas {pending ? "· sincronizando..." : ""}
          </p>
        </div>

        {session.exercises.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium">Todavia no agregaste ejercicios</p>
              <p className="text-xs text-muted-foreground mt-1">
                Elige un ejercicio para empezar a registrar las series reales de hoy.
              </p>
            </CardContent>
          </Card>
        ) : (
          session.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              session={session}
              exerciseId={exercise.exerciseId}
              title={exercise.exerciseName}
              target={
                exercise.targetSets > 0 || exercise.targetReps > 0
                  ? `${exercise.targetSets} x ${exercise.targetReps}`
                  : undefined
              }
              onSave={saveSet}
            />
          ))
        )}

        {planless && (
          <Card>
            <CardContent className="p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold">Agregar ejercicio</h2>
                <p className="text-xs text-muted-foreground">Suma ejercicios a esta sesion libre antes o durante el entrenamiento.</p>
              </div>
              <div className="flex gap-3">
                <select
                  className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedExerciseId}
                  onChange={(event) => setSelectedExerciseId(event.target.value)}
                >
                  {exercises.map((exercise) => (
                    <option value={exercise.id} key={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
                <Button onClick={addExerciseToSession} disabled={!selectedExerciseId || creatingExercise}>
                  {creatingExercise ? "Agregando..." : "Agregar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={() => setConfirmCompleteOpen(true)} disabled={session.exercises.length === 0 || completingWorkout}>
            Finalizar entrenamiento
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            disabled={completingWorkout || cancellingWorkout}
          >
            Suspender sesion
          </Button>
          <Button
            variant="destructive"
            onClick={() => setConfirmCancelOpen(true)}
            disabled={completingWorkout || cancellingWorkout}
          >
            Cancelar sesion
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar entrenamiento</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrara la sesion actual y se guardara como completada. Luego podras ver el resumen del dia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completingWorkout}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={completeWorkout} disabled={completingWorkout}>
              {completingWorkout ? "Finalizando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar sesion</AlertDialogTitle>
            <AlertDialogDescription>
              La sesion actual se marcara como abandonada y dejara de aparecer como entrenamiento en curso. Esta accion no finaliza el entrenamiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancellingWorkout}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={cancelWorkout}
              disabled={cancellingWorkout}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {cancellingWorkout ? "Cancelando..." : "Confirmar cancelacion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={completedDialogOpen} onOpenChange={setCompletedDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Entrenamiento finalizado</DialogTitle>
            <DialogDescription>
              La sesion se guardo correctamente. Ya puedes ver el resumen del dia.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCompletedDialogOpen(false)
                router.push("/")
              }}
            >
              Ir al inicio
            </Button>
            <Button
              onClick={() => {
                if (!completedSessionId) return
                setCompletedDialogOpen(false)
                router.push(`/history/${completedSessionId}`)
              }}
            >
              Ver resumen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  target?: string
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
            <p className="text-xs text-muted-foreground">{target ?? "Sin objetivo predefinido"}</p>
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
