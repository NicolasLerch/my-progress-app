"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Calendar, ChevronRight, Dumbbell, Play, Trophy } from "lucide-react"
import type { HomeTodayDTO } from "@my-progress/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatWeight, formatShortDate } from "@/lib/format"

export default function HomePage() {
  const [data, setData] = useState<HomeTodayDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getHome().then(setData).catch((cause: Error) => setError(cause.message))
  }, [])

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Cargando panel de hoy...</p>
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Bienvenido de nuevo</p>
          <h1 className="text-2xl font-bold text-foreground">{data.user.name}</h1>
        </div>
        <Link href="/settings" className="text-sm text-primary font-medium">
          Ajustes
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

      {data.todayDay && (
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-5 flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-primary font-medium">Entrenamiento de hoy</p>
              <h2 className="text-xl font-bold">{data.todayDay.name}</h2>
              <p className="text-sm text-muted-foreground">{data.todayDay.exercises.length} ejercicios planificados</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.todayDay.exercises.map((exercise) => (
                <span key={exercise.id} className="rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground">
                  {exercise.exerciseName}
                </span>
              ))}
            </div>
            <Button asChild className="h-12 gap-2">
              <Link href="/training/current">
                <Play className="w-5 h-5 fill-current" />
                {data.currentSession ? "Retomar entrenamiento" : "Comenzar entrenamiento"}
              </Link>
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
  )
}
