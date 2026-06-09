"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Calendar, ChevronRight, Dumbbell, LoaderCircle, Play, Trophy } from "lucide-react"
import type { HomeTodayDTO } from "@my-progress/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { formatWeight, formatShortDate } from "@/lib/format"
import { toast } from "@/hooks/use-toast"

function isPlanlessSession(session?: HomeTodayDTO["currentSession"]) {
  return Boolean(session && !session.planId)
}

export default function HomePage() {
  const router = useRouter()
  const { isLoading: authLoading, session, isReady } = useAuthReady()
  const [data, setData] = useState<HomeTodayDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [starting, setStarting] = useState<"planned" | "planless" | null>(null)
  const [selectedPlanDayId, setSelectedPlanDayId] = useState("")

  useEffect(() => {
    if (!isReady) {
      return
    }

    let cancelled = false
    setError(null)

    void api.getHome()
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) {
          setError(cause.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isReady, session])

  useEffect(() => {
    if (!session) {
      setData(null)
      setError(null)
    }
  }, [session])

  useEffect(() => {
    if (!data?.activePlan) return
    setSelectedPlanDayId(data.todayDay?.id ?? data.activePlan.days[0]?.id ?? "")
  }, [data])

  async function startPlannedWorkout(planDayId?: string) {
    if (!data) return
    if (data.currentSession) {
      router.push("/training/current")
      return
    }
    if (!data.activePlan) {
      return
    }
    const selectedDay = data.activePlan.days.find((day) => day.id === (planDayId ?? selectedPlanDayId))
    if (!selectedDay) return

    setStarting("planned")

    try {
      await api.createWorkoutSession({
        planId: data.activePlan.id,
        planDayId: selectedDay.id,
        date: new Date().toISOString(),
      })
      router.push("/training/current")
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "No se pudo iniciar el entrenamiento",
        description: cause instanceof Error ? cause.message : "Ocurrio un error inesperado.",
      })
    } finally {
      setStarting(null)
      setStartModalOpen(false)
    }
  }

  async function startPlanlessWorkout() {
    if (!data) return
    if (data.currentSession) {
      router.push("/training/current")
      return
    }

    setStarting("planless")

    try {
      await api.createWorkoutSession({
        mode: "planless",
        date: new Date().toISOString(),
      })
      router.push("/training/current")
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "No se pudo iniciar el entrenamiento libre",
        description: cause instanceof Error ? cause.message : "Ocurrio un error inesperado.",
      })
    } finally {
      setStarting(null)
      setStartModalOpen(false)
    }
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <LoaderCircle className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando sesion...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Cargando panel de hoy...</p>
  }

  const hasPlanForToday = Boolean(data.activePlan && data.todayDay)
  const currentSession = data.currentSession
  const startButtonLabel = currentSession ? "Retomar entrenamiento" : "Iniciar entrenamiento"
  const selectedPlanDay = data.activePlan?.days.find((day) => day.id === selectedPlanDayId)

  return (
    <>
      <div className="flex flex-col gap-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">Bienvenido de nuevo</p>
            <h1 className="text-2xl font-bold text-foreground">{data.user.name}</h1>
          </div>
          <Link href="/settings" className="text-sm text-primary font-medium">
            Mi Perfil
          </Link>
        </div>

        <Card className="bg-secondary/50 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Plan activo</p>
              <p className="text-sm font-medium text-foreground">{data.activePlan?.name ?? "Sin plan activo"}</p>
            </div>
            {data.activePlan && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Dia</p>
                <p className="text-sm font-semibold text-primary">
                  {data.activePlan.currentDay}/{data.activePlan.totalDays}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {hasPlanForToday ? (
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary font-medium">Entrenamiento de hoy</p>
                <h2 className="text-xl font-bold">{data.todayDay?.name}</h2>
                <p className="text-sm text-muted-foreground">{data.todayDay?.exercises.length ?? 0} ejercicios planificados</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.todayDay?.exercises.map((exercise) => (
                  <span key={exercise.id} className="rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground">
                    {exercise.exerciseName}
                  </span>
                ))}
              </div>
              <Button className="h-12 gap-2" onClick={() => setStartModalOpen(true)}>
                <Play className="w-5 h-5 fill-current" />
                {startButtonLabel}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardContent className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary font-medium">Entrenamiento</p>
                <h2 className="text-xl font-bold">
                  {currentSession ? currentSession.dayName : "Sin plan para hoy"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {currentSession
                    ? currentSession.planName
                    : "Puedes crear un plan nuevo o registrar un entrenamiento libre."}
                </p>
              </div>
              <Button className="h-12 gap-2" onClick={() => setStartModalOpen(true)}>
                <Play className="w-5 h-5 fill-current" />
                {startButtonLabel}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{data.stats.totalWorkouts}</p><p className="text-[10px] text-muted-foreground">Entrenamientos</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{data.stats.currentStreak}</p><p className="text-[10px] text-muted-foreground">Racha</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold">{formatWeight(data.stats.totalWeightLifted)}</p><p className="text-[10px] text-muted-foreground">Volumen total</p></CardContent></Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Actividad reciente</h3>
            <Link href="/history" className="text-xs text-primary font-medium flex items-center gap-1">
              Ver historial
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {data.recentSessions.map((session) => (
              <Card key={session.id} className="bg-card border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{session.dayName}</p>
                    <p className="text-xs text-muted-foreground">{formatShortDate(session.date)} · {session.exercises.length} ejercicios</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{session.durationMinutes ?? 0} min</p>
                    <p className="text-xs font-medium text-primary">{formatWeight(session.exercises.reduce((sum, exercise) => sum + exercise.sets.reduce((subtotal, set) => subtotal + set.weight * set.reps, 0), 0))}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Link href="/progress" className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Progreso por ejercicio</p>
            <p className="text-xs text-muted-foreground">Revisa records, maximos y volumen</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </Link>
      </div>

      <Dialog open={startModalOpen} onOpenChange={setStartModalOpen}>
        <DialogContent showCloseButton={!starting}>
          {currentSession ? (
            <>
              <DialogHeader>
                <DialogTitle>Entrenamiento en curso</DialogTitle>
                <DialogDescription>
                  {isPlanlessSession(currentSession)
                    ? "Tienes un entrenamiento libre en progreso."
                    : "Tienes un entrenamiento del plan en progreso."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => router.push("/training/current")}>Retomar entrenamiento actual</Button>
              </DialogFooter>
            </>
          ) : hasPlanForToday ? (
            <>
              <DialogHeader>
                <DialogTitle>Iniciar entrenamiento</DialogTitle>
                <DialogDescription>Elige si quieres seguir tu plan actual o registrar una sesion libre.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">Dia correspondiente</p>
                  <p className="text-sm font-medium">{data.todayDay?.name}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">O elegir otro dia del plan</label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedPlanDayId}
                    onChange={(event) => setSelectedPlanDayId(event.target.value)}
                  >
                    {data.activePlan?.days.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.order}. {day.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={startPlanlessWorkout} disabled={Boolean(starting)}>
                  {starting === "planless" ? "Iniciando..." : "Entrenar sin plan"}
                </Button>
                <Button onClick={() => startPlannedWorkout(selectedPlanDayId)} disabled={Boolean(starting) || !selectedPlanDay}>
                  {starting === "planned"
                    ? "Iniciando..."
                    : selectedPlanDay?.id === data.todayDay?.id
                      ? `Continuar con ${data.todayDay?.name}`
                      : `Continuar con ${selectedPlanDay?.name ?? "otro dia"}`}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Iniciar entrenamiento</DialogTitle>
                <DialogDescription>Sin plan activo, puedes crear uno nuevo o registrar una sesion libre.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={startPlanlessWorkout} disabled={Boolean(starting)}>
                  {starting === "planless" ? "Iniciando..." : "Entrenar sin plan"}
                </Button>
                <Button onClick={() => router.push("/plans/new")} disabled={Boolean(starting)}>
                  Crear nuevo plan
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
