"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, ChevronUp, Clock, History, Pause, Pencil, Play, RefreshCcw } from "lucide-react"
import type { ExerciseDTO, HomeTodayDTO, WorkoutExerciseDTO, WorkoutSessionDTO, WorkoutSetInputDTO } from "@my-progress/shared"
import { ExerciseSearchSelect } from "@/components/exercise-search-select"
import { api } from "@/lib/api"
import {
  clearSessionSetOperations,
  deleteSessionSnapshot,
  deleteTrainingDraft,
  getSessionSnapshot,
  getTrainingDraft,
  listSetOperations,
  queueSetOperation,
  removeSetOperation,
  saveSessionSnapshot,
  saveTrainingDraft,
  type RestTimerSnapshot,
  type TrainingDraftExerciseState,
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
import { AppLoadingIndicator } from "@/components/app-loading-indicator"
import { toast } from "@/hooks/use-toast"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { cn } from "@/lib/utils"
import {
  closeActiveWorkoutNotification,
  getNotificationPermission,
  requestWorkoutNotificationPermission,
  showActiveWorkoutNotification,
} from "@/lib/workout-session-notification"

type ExerciseUiState = TrainingDraftExerciseState
type PreviousPerformance = {
  weight: number
  reps: number
  date: string
}
type RestTimerState = {
  startedAt: number
  pausedAt?: number
}

function isPlanlessSession(session: WorkoutSessionDTO | null) {
  return Boolean(session && !session.planId)
}

function formatElapsedTime(startedAt: string, now: number) {
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingMinutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${remainingMinutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function formatTimerSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function getExerciseCompletion(exercise: WorkoutExerciseDTO) {
  if (exercise.targetSets > 0) {
    return exercise.sets.length >= exercise.targetSets
  }

  return exercise.sets.length > 0
}

function buildInitialExerciseUiState(session: WorkoutSessionDTO) {
  return session.exercises.reduce<Record<string, ExerciseUiState>>((accumulator, exercise, index) => {
    accumulator[exercise.id] = {
      expanded: index === 0,
      weight: exercise.sets.at(-1)?.weight?.toString() ?? "",
      reps: "",
      editingSetNumber: undefined,
    }

    return accumulator
  }, {})
}

function mergeExerciseSets(currentExercise: WorkoutExerciseDTO, incomingExercise: WorkoutExerciseDTO) {
  const setsByNumber = new Map(incomingExercise.sets.map((set) => [set.setNumber, set]))

  currentExercise.sets.forEach((currentSet) => {
    const incomingSet = setsByNumber.get(currentSet.setNumber)
    if (!incomingSet) {
      setsByNumber.set(currentSet.setNumber, currentSet)
      return
    }

    if (new Date(currentSet.updatedAt).getTime() > new Date(incomingSet.updatedAt).getTime()) {
      setsByNumber.set(currentSet.setNumber, currentSet)
    }
  })

  return Array.from(setsByNumber.values()).sort((left, right) => left.setNumber - right.setNumber)
}

function mergeWorkoutSessionState(current: WorkoutSessionDTO | null, incoming: WorkoutSessionDTO) {
  if (!current || current.id !== incoming.id) {
    return incoming
  }

  const currentExercisesById = new Map(current.exercises.map((exercise) => [exercise.id, exercise]))

  return {
    ...incoming,
    exercises: incoming.exercises.map((incomingExercise) => {
      const currentExercise = currentExercisesById.get(incomingExercise.id)
      if (!currentExercise) {
        return incomingExercise
      }

      return {
        ...incomingExercise,
        sets: mergeExerciseSets(currentExercise, incomingExercise),
      }
    }),
  }
}

function buildRestTimerState(
  session: WorkoutSessionDTO,
  draft?: { restTimers?: Record<string, RestTimerSnapshot> },
) {
  const validExerciseIds = new Set(session.exercises.map((exercise) => exercise.id))
  const restTimers = draft?.restTimers ?? {}

  return Object.entries(restTimers).reduce<Record<string, RestTimerState>>((accumulator, [workoutExerciseId, timer]) => {
    if (validExerciseIds.has(workoutExerciseId)) {
      accumulator[workoutExerciseId] = timer
    }

    return accumulator
  }, {})
}

export default function TrainingCurrentPage() {
  const router = useRouter()
  const { isLoading, isReady, session: authSession } = useAuthReady()
  const [home, setHome] = useState<HomeTodayDTO | null>(null)
  const [session, setSession] = useState<WorkoutSessionDTO | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDTO | null>(null)
  const [replacementExercise, setReplacementExercise] = useState<ExerciseDTO | null>(null)
  const [exerciseToReplace, setExerciseToReplace] = useState<WorkoutExerciseDTO | null>(null)
  const [selectedPlanDayId, setSelectedPlanDayId] = useState("")
  const [pending, setPending] = useState(false)
  const [creatingExercise, setCreatingExercise] = useState(false)
  const [replacingExercise, setReplacingExercise] = useState(false)
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false)
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null)
  const [completedDialogOpen, setCompletedDialogOpen] = useState(false)
  const [completingWorkout, setCompletingWorkout] = useState(false)
  const [cancellingWorkout, setCancellingWorkout] = useState(false)
  const [exerciseUiState, setExerciseUiState] = useState<Record<string, ExerciseUiState>>({})
  const [restTimers, setRestTimers] = useState<Record<string, RestTimerState>>({})
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [workoutNotificationPermission, setWorkoutNotificationPermission] = useState<NotificationPermission | "unsupported">("default")
  const sessionRef = useRef<WorkoutSessionDTO | null>(null)
  const pendingSyncCountRef = useRef(0)
  const notificationCompletionSessionRef = useRef<string | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    setWorkoutNotificationPermission(getNotificationPermission())
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    if (session.status === "in_progress" && workoutNotificationPermission === "granted") {
      void showActiveWorkoutNotification(session).catch(() => {})
      return
    }

    void closeActiveWorkoutNotification(session.id).catch(() => {})
  }, [session, workoutNotificationPermission])

  useEffect(() => {
    if (!isReady) return
    api.getHome().then(async (payload) => {
      setHome(payload)
      setSelectedPlanDayId(payload.todayDay?.id ?? payload.activePlan?.days[0]?.id ?? "")
      const currentSession = payload.currentSession
      if (currentSession) {
        const snapshot = await getSessionSnapshot(currentSession.id)
        setSession(snapshot ?? currentSession)
      }
    }).catch(() => {})
  }, [isReady])

  useEffect(() => {
    if (!authSession) {
      setHome(null)
      setSession(null)
      setSelectedExercise(null)
      setReplacementExercise(null)
      setExerciseToReplace(null)
      setSelectedPlanDayId("")
      setExerciseUiState({})
      setRestTimers({})
    }
  }, [authSession])

  useEffect(() => {
    if (!session) {
      setExerciseUiState({})
      setRestTimers({})
      return
    }

    const currentSession = session
    let cancelled = false

    async function loadDraft() {
      const baseState = buildInitialExerciseUiState(currentSession)
      const draft = await getTrainingDraft(currentSession.id)
      if (cancelled) {
        return
      }

      setExerciseUiState(
        draft
          ? Object.entries(baseState).reduce<Record<string, ExerciseUiState>>((accumulator, [workoutExerciseId, state]) => {
              accumulator[workoutExerciseId] = {
                expanded: draft.exercises[workoutExerciseId]?.expanded ?? state.expanded,
                weight: draft.exercises[workoutExerciseId]?.weight ?? state.weight,
                reps: draft.exercises[workoutExerciseId]?.reps ?? state.reps,
                editingSetNumber: draft.exercises[workoutExerciseId]?.editingSetNumber,
              }
              return accumulator
            }, {})
          : baseState,
      )
      setRestTimers(buildRestTimerState(currentSession, draft))
    }

    void loadDraft()

    return () => {
      cancelled = true
    }
  }, [session?.id])

  useEffect(() => {
    if (!session) return
    void flushQueue(session.id)
  }, [session?.id])

  useEffect(() => {
    if (!session) return

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [session?.id])

  const completedExercises = useMemo(
    () => session?.exercises.filter(getExerciseCompletion).length ?? 0,
    [session],
  )

  const totalCompletedSets = useMemo(
    () => session?.exercises.reduce((count, exercise) => count + exercise.sets.length, 0) ?? 0,
    [session],
  )

  const previousPerformanceByExercise = useMemo(() => {
    if (!home) {
      return {}
    }

    return home.recentSessions
      .filter((item) => item.status === "completed")
      .reduce<Record<string, PreviousPerformance>>((accumulator, workoutSession) => {
        workoutSession.exercises.forEach((exercise) => {
          if (accumulator[exercise.exerciseId] || exercise.sets.length === 0) {
            return
          }

          const lastSet = exercise.sets.at(-1)
          if (!lastSet) {
            return
          }

          accumulator[exercise.exerciseId] = {
            weight: lastSet.weight,
            reps: lastSet.reps,
            date: workoutSession.date,
          }
        })

        return accumulator
      }, {})
  }, [home])

  async function persistTrainingDraft(nextState: {
    exercises?: Record<string, ExerciseUiState>
    restTimers?: Record<string, RestTimerState>
  }) {
    if (!session) {
      return
    }

    await saveTrainingDraft({
      id: session.id,
      exercises: nextState.exercises ?? exerciseUiState,
      restTimers: nextState.restTimers ?? restTimers,
    })
  }

  async function persistExerciseUiState(nextState: Record<string, ExerciseUiState>) {
    await persistTrainingDraft({ exercises: nextState })
  }

  function updateExerciseUi(workoutExerciseId: string, updater: (state: ExerciseUiState) => ExerciseUiState) {
    setExerciseUiState((currentState) => {
      const nextState = {
        ...currentState,
        [workoutExerciseId]: updater(currentState[workoutExerciseId] ?? { expanded: false, weight: "", reps: "" }),
      }

      void persistExerciseUiState(nextState)
      return nextState
    })
  }

  function startRestTimer(workoutExerciseId: string) {
    setRestTimers((currentTimers) => {
      const nextTimers = {
        ...currentTimers,
        [workoutExerciseId]: { startedAt: Date.now() },
      }

      void persistTrainingDraft({ restTimers: nextTimers })
      return nextTimers
    })
  }

  function toggleRestTimer(workoutExerciseId: string) {
    setRestTimers((currentTimers) => {
      const timer = currentTimers[workoutExerciseId]
      if (!timer) {
        return currentTimers
      }

      let nextTimers: Record<string, RestTimerState>
      if (timer.pausedAt) {
        const pausedDuration = Date.now() - timer.pausedAt
        nextTimers = {
          ...currentTimers,
          [workoutExerciseId]: {
            startedAt: timer.startedAt + pausedDuration,
          },
        }
      } else {
        nextTimers = {
          ...currentTimers,
          [workoutExerciseId]: {
            ...timer,
            pausedAt: Date.now(),
          },
        }
      }

      void persistTrainingDraft({ restTimers: nextTimers })
      return nextTimers
    })
  }

  async function enableWorkoutNotifications() {
    const permission = await requestWorkoutNotificationPermission()
    setWorkoutNotificationPermission(permission)
  }

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
    if (!session || !selectedExercise) {
      return
    }

    setCreatingExercise(true)

    try {
      const updated = await api.addWorkoutExercise(session.id, { exerciseId: selectedExercise.id })
      await saveSessionSnapshot(updated)
      setSession(updated)
      setSelectedExercise(null)
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
    const operations = await listSetOperations(sessionId)
    if (operations.length === 0) {
      return true
    }

    if (!navigator.onLine) {
      return false
    }

    for (const operation of operations) {
      try {
        await api.upsertWorkoutSet(operation.sessionId, operation.workoutExerciseId, operation.payload)
        await removeSetOperation(operation.id)
      } catch {
        return false
      }
    }

    return true
  }

  async function saveSet(workoutExerciseId: string) {
    if (!session) return

    const draft = exerciseUiState[workoutExerciseId]
    const exercise = session.exercises.find((item) => item.id === workoutExerciseId)

    if (!draft || !exercise || !draft.weight || !draft.reps) {
      return
    }

    const editingSetNumber = draft.editingSetNumber
    const setNumber = editingSetNumber ?? exercise.sets.length + 1
    const payload: WorkoutSetInputDTO = {
      setNumber,
      weight: Number(draft.weight),
      reps: Number(draft.reps),
      updatedAt: new Date().toISOString(),
    }

    const nextSession: WorkoutSessionDTO = {
      ...session,
      exercises: session.exercises.map((item) =>
        item.id === workoutExerciseId
          ? {
              ...item,
              sets: editingSetNumber
                ? item.sets.map((savedSet) =>
                    savedSet.setNumber === setNumber
                      ? {
                          ...savedSet,
                          weight: payload.weight,
                          reps: payload.reps,
                          updatedAt: payload.updatedAt,
                        }
                      : savedSet,
                  )
                : [
                    ...item.sets,
                    {
                      id: `${item.id}-${setNumber}`,
                      workoutExerciseId: item.id,
                      setNumber,
                      weight: payload.weight,
                      reps: payload.reps,
                      createdAt: payload.updatedAt,
                      updatedAt: payload.updatedAt,
                    },
                  ],
            }
          : item,
      ),
    }

    const updatedExercise = nextSession.exercises.find((item) => item.id === workoutExerciseId)
    const nextDefaultWeight = updatedExercise?.sets.at(-1)?.weight?.toString() ?? ""

    const nextExerciseState = {
      ...exerciseUiState,
      [workoutExerciseId]: {
        ...draft,
        expanded: true,
        weight: nextDefaultWeight,
        reps: "",
        editingSetNumber: undefined,
      },
    }

    setSession(nextSession)
    setExerciseUiState(nextExerciseState)
    if (!editingSetNumber) {
      startRestTimer(workoutExerciseId)
    }
    await saveSessionSnapshot(nextSession)
    await persistTrainingDraft({ exercises: nextExerciseState })
    await queueSetOperation(session.id, workoutExerciseId, payload)
    pendingSyncCountRef.current += 1
    setPending(true)

    try {
      const synced = await api.upsertWorkoutSet(session.id, workoutExerciseId, payload)
      const mergedSession = mergeWorkoutSessionState(sessionRef.current, synced)
      await saveSessionSnapshot(mergedSession)
      setSession(mergedSession)
      await removeSetOperation(`${session.id}-${workoutExerciseId}-${setNumber}`)
    } catch {
      // Keep the queued operation to retry later when connectivity is restored.
    } finally {
      pendingSyncCountRef.current = Math.max(0, pendingSyncCountRef.current - 1)
      setPending(pendingSyncCountRef.current > 0)
    }
  }

  function openReplaceDialog(exercise: WorkoutExerciseDTO) {
    setExerciseToReplace(exercise)
    setReplacementExercise(null)
    setReplaceDialogOpen(true)
  }

  async function replaceExerciseInSession() {
    if (!session || !exerciseToReplace || !replacementExercise) {
      return
    }

    setReplacingExercise(true)

    try {
      const updated = await api.replaceWorkoutExercise(session.id, exerciseToReplace.id, {
        exerciseId: replacementExercise.id,
      })
      await saveSessionSnapshot(updated)
      setSession(updated)
      setReplacementExercise(null)
      setExerciseToReplace(null)
      setReplaceDialogOpen(false)
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "No se pudo cambiar el ejercicio",
        description: cause instanceof Error ? cause.message : "Ocurrio un error inesperado.",
      })
    } finally {
      setReplacingExercise(false)
    }
  }

  async function completeWorkout() {
    if (!session) return
    setCompletingWorkout(true)

    try {
      const synced = await flushQueue(session.id)
      if (!synced) {
        throw new Error("Todavia hay series pendientes de sincronizar. Espera un momento e intenta nuevamente.")
      }

      const completed = await api.completeWorkoutSession(session.id)
      await closeActiveWorkoutNotification(session.id)
      setSession(completed)
      setCompletedSessionId(completed.id)
      setCompletedDialogOpen(true)
      await deleteSessionSnapshot(session.id)
      await deleteTrainingDraft(session.id)
      await clearSessionSetOperations(session.id)
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
      await closeActiveWorkoutNotification(session.id)
      await deleteSessionSnapshot(session.id)
      await deleteTrainingDraft(session.id)
      await clearSessionSetOperations(session.id)
      setConfirmCancelOpen(false)
      router.push("/")
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "No se pudo cancelar la sesión",
        description: cause instanceof Error ? cause.message : "Ocurrio un error inesperado.",
      })
    } finally {
      setCancellingWorkout(false)
    }
  }

  useEffect(() => {
    if (!session || session.status !== "in_progress" || typeof window === "undefined") {
      return
    }

    const requestedSessionId = new URLSearchParams(window.location.search).get("completeSession")
    if (requestedSessionId !== session.id || notificationCompletionSessionRef.current === session.id) {
      return
    }

    notificationCompletionSessionRef.current = session.id
    const url = new URL(window.location.href)
    url.searchParams.delete("completeSession")
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
    void completeWorkout()
  }, [session?.id, session?.status])

  if (isLoading) {
    return <AppLoadingIndicator label="Verificando sesión..." />
  }

  if (!home) {
    return <AppLoadingIndicator label="Cargando entrenamiento..." />
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
  const sessionDayName = planless && session.dayName === "Sesion sin plan" ? "Entrenamiento libre" : session.dayName

  return (
    <>
      <div className="flex flex-col gap-4 pb-4">
        <div className="rounded-3xl border border-primary/20 bg-linear-to-br from-primary/12 via-card to-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary/80">Sesión en curso</p>
              <h1 className="mt-1 text-2xl font-bold">{sessionDayName}</h1>
              <p className="text-sm text-muted-foreground">
                {session.planName} · {totalCompletedSets} series guardadas {pending ? "· sincronizando..." : ""}
              </p>
            </div>
            <div className="rounded-full border border-primary/20 bg-background/80 px-3 py-1.5 text-sm font-semibold text-primary">
              {formatElapsedTime(session.startedAt, clockNow)}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${session.exercises.length === 0 ? 0 : (completedExercises / session.exercises.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {completedExercises}/{session.exercises.length}
            </span>
          </div>

          {workoutNotificationPermission === "default" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void enableWorkoutNotifications()}
              className="mt-3 -ml-2 text-xs text-primary hover:text-primary"
            >
              <Clock className="size-3.5" />
              Activar recordatorio de entrenamiento
            </Button>
          ) : null}
        </div>

        {session.exercises.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium">Todavia no agregaste ejercicios</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Elige un ejercicio para empezar a registrar las series reales de hoy.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {session.exercises.map((exercise, exerciseIndex) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                exerciseIndex={exerciseIndex}
                state={exerciseUiState[exercise.id] ?? { expanded: exerciseIndex === 0, weight: "", reps: "" }}
                previousPerformance={previousPerformanceByExercise[exercise.exerciseId]}
                onToggleExpand={() =>
                  updateExerciseUi(exercise.id, (current) => ({
                    ...current,
                    expanded: !current.expanded,
                  }))
                }
                onDraftChange={(field, value) =>
                  updateExerciseUi(exercise.id, (current) => ({
                    ...current,
                    [field]: value,
                  }))
                }
                onStartEdit={(setNumber) =>
                  updateExerciseUi(exercise.id, (current) => {
                    const savedSet = exercise.sets.find((item) => item.setNumber === setNumber)
                    if (!savedSet) {
                      return current
                    }

                    return {
                      ...current,
                      expanded: true,
                      editingSetNumber: setNumber,
                      weight: String(savedSet.weight),
                      reps: String(savedSet.reps),
                    }
                  })
                }
                onCancelEdit={() =>
                  updateExerciseUi(exercise.id, (current) => ({
                    ...current,
                    editingSetNumber: undefined,
                    weight: exercise.sets.at(-1)?.weight?.toString() ?? "",
                    reps: "",
                  }))
                }
                onSave={() => saveSet(exercise.id)}
                onReplace={!planless && exercise.sets.length === 0 ? () => openReplaceDialog(exercise) : undefined}
                restTimer={restTimers[exercise.id]}
                now={clockNow}
                onToggleRestTimer={() => toggleRestTimer(exercise.id)}
              />
            ))}
          </div>
        )}

        {planless && (
          <Card>
            <CardContent className="p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold">Agregar ejercicio</h2>
                <p className="text-xs text-muted-foreground">Suma ejercicios a este entrenamiento libre antes o durante el entrenamiento.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <ExerciseSearchSelect
                    value={selectedExercise?.id ?? ""}
                    selectedExercise={selectedExercise ?? undefined}
                    searchExercises={(query) => api.getExercises(query, 20)}
                    onSelect={setSelectedExercise}
                  />
                </div>
                <Button
                  onClick={addExerciseToSession}
                  disabled={!selectedExercise || creatingExercise}
                  className="w-full sm:w-auto"
                >
                  {creatingExercise ? "Agregando..." : "Agregar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 safe-bottom">
          <Button onClick={() => setConfirmCompleteOpen(true)} disabled={session.exercises.length === 0 || completingWorkout}>
            Finalizar entrenamiento
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            disabled={completingWorkout || cancellingWorkout}
          >
            Salir y continuar luego
          </Button>
          <Button
            variant="destructive"
            onClick={() => setConfirmCancelOpen(true)}
            disabled={completingWorkout || cancellingWorkout}
          >
            Cancelar sesión
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar entrenamiento</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará la sesión actual, se limpiará el cache local de esta sesión y podrás ver el resumen del día.
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
            <AlertDialogTitle>Cancelar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción descarta la sesión y borra su cache local. Si quieres seguir luego, usa "Salir y continuar luego".
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

      <Dialog
        open={replaceDialogOpen}
        onOpenChange={(open) => {
          setReplaceDialogOpen(open)
          if (!open) {
            setExerciseToReplace(null)
            setReplacementExercise(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar ejercicio del plan</DialogTitle>
            <DialogDescription>
              {exerciseToReplace
                ? `Este cambio solo afecta la sesión actual. Reemplazarás ${exerciseToReplace.exerciseName}.`
                : "Selecciona el ejercicio que vas a hacer en esta sesión."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <ExerciseSearchSelect
              value={replacementExercise?.id ?? ""}
              selectedExercise={replacementExercise ?? undefined}
              searchExercises={(query) => api.getExercises(query, 20)}
              onSelect={setReplacementExercise}
              placeholder="Selecciona el ejercicio real"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReplaceDialogOpen(false)
                setExerciseToReplace(null)
                setReplacementExercise(null)
              }}
              disabled={replacingExercise}
            >
              Cancelar
            </Button>
            <Button onClick={replaceExerciseInSession} disabled={!replacementExercise || replacingExercise}>
              {replacingExercise ? "Cambiando..." : "Confirmar cambio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completedDialogOpen} onOpenChange={setCompletedDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Entrenamiento finalizado</DialogTitle>
            <DialogDescription>
              La sesión se guardó correctamente y el cache local de esta sesión fue eliminado.
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
  exercise,
  exerciseIndex,
  state,
  previousPerformance,
  onToggleExpand,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onReplace,
  restTimer,
  now,
  onToggleRestTimer,
}: {
  exercise: WorkoutExerciseDTO
  exerciseIndex: number
  state: ExerciseUiState
  previousPerformance?: PreviousPerformance
  onToggleExpand: () => void
  onDraftChange: (field: "weight" | "reps", value: string) => void
  onStartEdit: (setNumber: number) => void
  onCancelEdit: () => void
  onSave: () => Promise<void>
  onReplace?: () => void
  restTimer?: RestTimerState
  now: number
  onToggleRestTimer: () => void
}) {
  const completed = getExerciseCompletion(exercise)
  const displayRowCount = Math.max(exercise.targetSets, exercise.sets.length + 1)
  const timerReference = restTimer?.pausedAt ?? now
  const elapsedRestSeconds = restTimer
    ? Math.max(0, Math.floor((timerReference - restTimer.startedAt) / 1000))
    : 0
  const remainingRestSeconds = Math.max(0, exercise.restSeconds - elapsedRestSeconds)
  const overtimeSeconds = Math.max(0, elapsedRestSeconds - exercise.restSeconds)

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/70 bg-card transition-all duration-200",
        completed && "border-primary/30 bg-primary/5",
      )}
    >
      <CardContent className="p-0">
        <button
          onClick={onToggleExpand}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
              completed ? "bg-primary text-primary-foreground" : "bg-secondary/90 text-muted-foreground",
            )}
          >
            {completed ? <Check className="size-4" /> : exerciseIndex + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("font-medium", completed && "text-primary")}>{exercise.exerciseName}</p>
              {exercise.isReplacement ? (
                <span className="rounded-full bg-secondary/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Reemplazo del plan
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {exercise.targetSets > 0 || exercise.targetReps.trim().length > 0
                ? `${exercise.targetSets} series x ${exercise.targetReps} reps · ${exercise.restSeconds}s descanso`
                : "Sin objetivo predefinido"}
            </p>
          </div>

          {state.expanded ? (
            <ChevronUp className="size-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-5 text-muted-foreground" />
          )}
        </button>

        {state.expanded ? (
          <div className="border-t border-border/50 px-4 pb-4">
            {onReplace ? (
              <div className="pt-3">
                <Button variant="outline" size="sm" onClick={onReplace} className="gap-2">
                  <RefreshCcw className="size-4" />
                  Cambiar ejercicio
                </Button>
              </div>
            ) : null}

            {previousPerformance ? (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <History className="size-3.5" />
                <span>
                  Ultimo: <span className="font-medium text-foreground">{previousPerformance.weight}kg x {previousPerformance.reps}</span>
                </span>
              </div>
            ) : null}

            <div className="mt-2 flex flex-col gap-2">
              {state.editingSetNumber ? (
                <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                  <span className="font-medium text-foreground">Editando serie {state.editingSetNumber}</span>
                  <button className="text-primary" onClick={onCancelEdit}>
                    Cancelar
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-[44px_1fr_1fr_48px] gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span>Serie</span>
                <span>Peso</span>
                <span>Reps</span>
                <span />
              </div>

              {Array.from({ length: displayRowCount }, (_, index) => {
                const setNumber = index + 1
                const savedSet = exercise.sets[index]
                const isEditingSavedSet = state.editingSetNumber === setNumber
                const isEditableRow = isEditingSavedSet || (!savedSet && !state.editingSetNumber && setNumber === exercise.sets.length + 1)

                return (
                  <div
                    key={setNumber}
                    className={cn(
                      "grid grid-cols-[44px_1fr_1fr_48px] items-center gap-2",
                      savedSet && "opacity-70",
                    )}
                  >
                    <div className="flex items-center justify-center">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                          savedSet ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {setNumber}
                      </span>
                    </div>

                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder={exercise.sets.at(-1)?.weight?.toString() ?? "0"}
                      value={isEditableRow ? state.weight : savedSet ? String(savedSet.weight) : ""}
                      onChange={(event) => onDraftChange("weight", event.target.value)}
                      className="h-10 border-0 bg-secondary/90 text-center font-medium"
                      disabled={!isEditableRow}
                    />

                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder={exercise.targetReps}
                      value={isEditableRow ? state.reps : savedSet ? String(savedSet.reps) : ""}
                      onChange={(event) => onDraftChange("reps", event.target.value)}
                      className="h-10 border-0 bg-secondary/90 text-center font-medium"
                      disabled={!isEditableRow}
                    />

                    {savedSet && !isEditingSavedSet ? (
                      <button
                        onClick={() => onStartEdit(setNumber)}
                        className="flex h-10 items-center justify-center rounded-lg bg-secondary/90 text-muted-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                        aria-label={`Editar serie ${setNumber}`}
                      >
                        <Pencil className="size-4" />
                      </button>
                    ) : savedSet ? (
                      <button
                        onClick={() => void onSave()}
                        className={cn(
                          "flex h-10 items-center justify-center rounded-lg transition-colors",
                          state.weight && state.reps
                            ? "bg-secondary/90 text-muted-foreground hover:bg-primary/20 hover:text-primary"
                            : "bg-secondary/70 text-muted-foreground/50",
                        )}
                        disabled={!state.weight || !state.reps}
                      >
                        <Check className="size-4" />
                      </button>
                    ) : isEditableRow ? (
                      <button
                        onClick={() => void onSave()}
                        className={cn(
                          "flex h-10 items-center justify-center rounded-lg transition-colors",
                          state.weight && state.reps
                            ? "bg-secondary/90 text-muted-foreground hover:bg-primary/20 hover:text-primary"
                            : "bg-secondary/70 text-muted-foreground/50",
                        )}
                        disabled={!state.weight || !state.reps}
                      >
                        <Check className="size-4" />
                      </button>
                    ) : (
                      <div className="h-10 rounded-lg bg-secondary/70" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/65 p-2.5">
              <Clock className={cn("size-4", restTimer ? "text-primary" : "text-muted-foreground")} />
              <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                {restTimer ? (
                  <>
                    <p className="text-xl font-bold leading-none tabular-nums text-foreground">
                      {exercise.restSeconds === 0
                        ? `Cronómetro ${formatTimerSeconds(elapsedRestSeconds)}`
                        : remainingRestSeconds > 0
                          ? `Pausa ${formatTimerSeconds(remainingRestSeconds)}`
                          : `Pausa +${formatTimerSeconds(overtimeSeconds)}`}
                    </p>
                    <p>
                      {restTimer.pausedAt
                        ? "Temporizador pausado"
                        : exercise.restSeconds === 0
                          ? "Tiempo desde la última serie"
                          : `Descanso recomendado: ${exercise.restSeconds}s`}
                    </p>
                  </>
                ) : (
                  <p>
                    Descanso recomendado: <span className="font-medium text-foreground">{exercise.restSeconds}s</span>
                  </p>
                )}
              </div>
              {restTimer ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleRestTimer}
                  aria-label={restTimer.pausedAt ? "Reanudar temporizador" : "Pausar temporizador"}
                  title={restTimer.pausedAt ? "Reanudar" : "Pausar"}
                >
                  {restTimer.pausedAt ? <Play className="size-4" /> : <Pause className="size-4" />}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
