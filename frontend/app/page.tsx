"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Activity, ChevronLeft, ChevronRight, Dumbbell, Play, Plus, Trophy } from "lucide-react"
import type { PlanDayDTO, WorkoutSessionDTO } from "@my-progress/shared"
import { AppLoadingIndicator } from "@/components/app-loading-indicator"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel"
import { api } from "@/lib/api"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useAppBoot } from "@/components/app-boot-provider"
import { formatShortDate, formatWeight } from "@/lib/format"
import { toast } from "@/hooks/use-toast"

const planDayImages = [
  "/home/air_bike.avif",
  "/home/rowing.avif",
  "/home/russian_dumbbell.avif",
  "/home/shoulder_dumbbell.avif",
  "/home/shoulder_press.avif",
  "/home/squats.avif",
]

function getPlanDayImage(order: number) {
  return planDayImages[(Math.max(order, 1) - 1) % planDayImages.length]
}

function getExercisePreview(day: PlanDayDTO) {
  const visibleExercises = day.exercises.slice(0, 3)

  return {
    visibleExercises,
    remainingCount: Math.max(day.exercises.length - visibleExercises.length, 0),
  }
}

function getSessionDisplayDayName(session?: WorkoutSessionDTO) {
  if (session && !session.planId && session.dayName === "Sesion sin plan") {
    return "Entrenamiento libre"
  }

  return session?.dayName ?? ""
}

function getSessionVolume(session: WorkoutSessionDTO) {
  return session.exercises.reduce(
    (total, exercise) => total + exercise.sets.reduce((subtotal, set) => subtotal + set.weight * set.reps, 0),
    0,
  )
}

export default function HomePage() {
  const router = useRouter()
  const { isLoading: authLoading, session } = useAuthReady()
  const { homeData: data, homeError: error } = useAppBoot()
  const [startingPlanDayId, setStartingPlanDayId] = useState<string | null>(null)
  const [startingPlanless, setStartingPlanless] = useState(false)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [selectedSlide, setSelectedSlide] = useState(0)

  useEffect(() => {
    if (!carouselApi) return

    const onSelect = () => setSelectedSlide(carouselApi.selectedScrollSnap())

    onSelect()
    carouselApi.on("select", onSelect)
    carouselApi.on("reInit", onSelect)

    return () => {
      carouselApi.off("select", onSelect)
      carouselApi.off("reInit", onSelect)
    }
  }, [carouselApi])

  async function startPlannedWorkout(planDayId: string) {
    if (!data?.activePlan) return

    if (data.currentSession) {
      router.push("/training/current")
      return
    }

    setStartingPlanDayId(planDayId)

    try {
      await api.createWorkoutSession({
        planId: data.activePlan.id,
        planDayId,
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
      setStartingPlanDayId(null)
    }
  }

  async function startPlanlessWorkout() {
    if (!data) return

    if (data.currentSession) {
      router.push("/training/current")
      return
    }

    setStartingPlanless(true)

    try {
      await api.createWorkoutSession({ mode: "planless", date: new Date().toISOString() })
      router.push("/training/current")
    } catch (cause) {
      toast({
        variant: "destructive",
        title: "No se pudo iniciar el entrenamiento libre",
        description: cause instanceof Error ? cause.message : "Ocurrio un error inesperado.",
      })
    } finally {
      setStartingPlanless(false)
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  if (authLoading) return <AppLoadingIndicator label="Verificando sesion..." />

  if (!session) return null

  if (!data) return <AppLoadingIndicator label="Cargando inicio..." />

  const { activePlan, currentSession } = data
  const lastSession = data.recentSessions[0]
  const isStarting = Boolean(startingPlanDayId) || startingPlanless

  return (
    <div className="flex w-full flex-col gap-7 pb-6">
      <header className="flex w-full items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Hola, {data.user.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Tu próximo entrenamiento</h1>
        </div>
        <Link href="/settings" className="text-sm font-medium text-primary">
          Mi perfil
        </Link>
      </header>

      {activePlan ? (
        <section className="flex w-full flex-col gap-4" aria-label={`Plan activo: ${activePlan.name}`}>
          {activePlan.days.length > 0 ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Tu semana</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Elige tu sesión</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full border border-border/60"
                    onClick={() => carouselApi?.scrollPrev()}
                    disabled={!carouselApi || activePlan.days.length < 2}
                    aria-label="Sesión anterior"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full border border-border/60"
                    onClick={() => carouselApi?.scrollNext()}
                    disabled={!carouselApi || activePlan.days.length < 2}
                    aria-label="Siguiente sesión"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              <Carousel setApi={setCarouselApi} opts={{ align: "start", loop: activePlan.days.length > 1 }} className="w-full">
                <CarouselContent className="!ml-0">
                  {activePlan.days.map((day) => {
                    const { visibleExercises, remainingCount } = getExercisePreview(day)
                    const isCurrentDay = day.id === data.todayDay?.id
                    const isStartingThisDay = startingPlanDayId === day.id

                    return (
                      <CarouselItem key={day.id} className="basis-full pl-0">
                        <article className="relative min-h-[27rem] overflow-hidden rounded-lg border border-border/50 bg-card shadow-2xl shadow-black/20">
                          <Image
                            src={getPlanDayImage(day.order)}
                            alt={`Día ${day.order}: ${day.name}`}
                            fill
                            priority={day.order === 1}
                            sizes="(max-width: 640px) 100vw, 512px"
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
                          <div className="relative flex min-h-[27rem] flex-col justify-end gap-4 p-5 text-white">
                            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                              <span>Día {day.order}</span>
                              {isCurrentDay && <span className="rounded-full bg-primary px-2.5 py-1 text-primary-foreground">Hoy</span>}
                            </div>
                            <div>
                              <h3 className="text-3xl font-bold tracking-tight">{day.name}</h3>
                              <p className="mt-1 text-sm text-white/75">{day.exercises.length} ejercicios planificados</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {visibleExercises.map((exercise) => (
                                <span key={exercise.id} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                                  {exercise.exerciseName}
                                </span>
                              ))}
                              {remainingCount > 0 && <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">+{remainingCount}</span>}
                            </div>
                            <Button
                              className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => startPlannedWorkout(day.id)}
                              disabled={isStarting}
                            >
                              <Play className="size-5 fill-current" />
                              {currentSession ? "Retomar entrenamiento" : isStartingThisDay ? "Iniciando..." : "Comenzar entrenamiento"}
                            </Button>
                          </div>
                        </article>
                      </CarouselItem>
                    )
                  })}
                </CarouselContent>
              </Carousel>

              <div className="flex justify-center gap-2" role="tablist" aria-label="Dias del plan">
                {activePlan.days.map((day, index) => (
                  <button
                    key={day.id}
                    type="button"
                    className="flex size-7 items-center justify-center"
                    onClick={() => carouselApi?.scrollTo(index)}
                    aria-label={`Ir al día ${day.order}: ${day.name}`}
                    aria-selected={selectedSlide === index}
                    role="tab"
                  >
                    <span className={`h-2 rounded-full transition-all ${selectedSlide === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/45"}`} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Card className="rounded-lg border-dashed border-border/70 bg-secondary/20">
              <CardContent className="p-5 text-sm text-muted-foreground">
                Este plan todavia no tiene días configurados. Editalo para poder iniciar un entrenamiento.
              </CardContent>
            </Card>
          )}

          <div className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-card/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Entrenamiento libre</p>
              <p className="text-xs text-muted-foreground">Registra una sesión fuera de tu plan</p>
            </div>
            <Button variant="ghost" size="sm" onClick={startPlanlessWorkout} disabled={isStarting}>
              {currentSession ? "Retomar" : startingPlanless ? "Iniciando..." : "Iniciar"}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </section>
      ) : (
        <section className="w-full" aria-labelledby="empty-plan-heading">
          <Card className="w-full overflow-hidden rounded-lg border-primary/20 bg-gradient-to-br from-primary/12 via-card to-card">
            <CardContent className="flex flex-col gap-5 p-6">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
                <Dumbbell className="size-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Empeza por tu plan</p>
                <h2 id="empty-plan-heading" className="mt-2 text-2xl font-bold">Todavia no tenes un plan activo</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Crea una rutina para elegir y registrar cada entrenamiento desde aca.</p>
              </div>
              <Button className="h-12" asChild>
                <Link href="/plans/new"><Plus className="size-5" />Crear plan</Link>
              </Button>
              <Button variant="ghost" onClick={startPlanlessWorkout} disabled={isStarting}>
                <Play className="size-4" />
                {currentSession ? "Retomar entrenamiento actual" : startingPlanless ? "Iniciando entrenamiento libre..." : "Iniciar entrenamiento libre"}
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="w-full" aria-labelledby="progress-heading">
        <Card className="w-full overflow-hidden rounded-lg border-primary/20 bg-gradient-to-br from-primary/14 via-card to-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Tu progreso</p>
                <h2 id="progress-heading" className="mt-1 text-xl font-bold">Más fuerte que el mes pasado</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Estamos preparando tu comparativa mensual con tus mejores avances y volumen.</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Activity className="size-5 text-primary" />
              </div>
            </div>
            <div className="mt-5 flex h-12 items-end gap-1.5" aria-hidden="true">
              {[35, 48, 42, 64, 58, 78, 92].map((height, index) => (
                <span key={index} className="flex-1 rounded-t-sm bg-primary/20 last:bg-primary" style={{ height: `${height}%` }} />
              ))}
            </div>
            <Button variant="link" className="mt-4 h-auto px-0 text-primary" asChild>
              <Link href="/progress">Ver mi progreso <ChevronRight className="size-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="w-full" aria-labelledby="last-session-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="last-session-heading" className="text-base font-semibold">Ultima sesión</h2>
          <Link href="/history" className="flex items-center gap-1 text-xs font-medium text-primary">Ver historial <ChevronRight className="size-3" /></Link>
        </div>
        {lastSession ? (
          <Card className="w-full rounded-lg border-border/60 bg-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Dumbbell className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{getSessionDisplayDayName(lastSession)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatShortDate(lastSession.date)} · {lastSession.exercises.length} ejercicios</p>
              </div>
              <div className="text-right text-xs">
                <p className="text-muted-foreground">{lastSession.durationMinutes ?? 0} min</p>
                <p className="mt-0.5 font-semibold text-primary">{formatWeight(getSessionVolume(lastSession))}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full rounded-lg border-dashed border-border/70 bg-secondary/20">
            <CardContent className="p-4 text-sm text-muted-foreground">Cuando completes un entrenamiento, va a aparecer aca.</CardContent>
          </Card>
        )}
      </section>

      <Link href="/progress" className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-card p-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
          <Trophy className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Progreso por ejercicio</p>
          <p className="text-xs text-muted-foreground">Revisa tus records, pesos y volumen</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
    </div>
  )
}
