"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts"
import type { ExerciseDTO, ProgressSeriesDTO } from "@my-progress/shared"
import { ExerciseSearchSelect } from "@/components/exercise-search-select"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { api } from "@/lib/api"
import { formatShortDate } from "@/lib/format"

export default function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDTO | null>(null)
  const [series, setSeries] = useState<ProgressSeriesDTO | null>(null)
  const { isLoading, isReady, session } = useAuthReady()

  useEffect(() => {
    if (!isReady) return
    api.getProgressExercises("", 1).then((items) => {
      if (items[0]) {
        setSelectedExercise(items[0])
      }
    }).catch(() => {})
  }, [isReady])

  useEffect(() => {
    if (!isReady || !selectedExercise?.id) {
      setSeries(null)
      return
    }
    api.getProgressSeries(selectedExercise.id).then(setSeries).catch(() => {})
  }, [isReady, selectedExercise?.id])

  useEffect(() => {
    if (!session) {
      setSelectedExercise(null)
      setSeries(null)
    }
  }, [session])

  const chartData = useMemo(
    () => series?.points.map((point) => ({ ...point, displayDate: formatShortDate(point.date) })) ?? [],
    [series],
  )

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Verificando sesión...</p>
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Progreso</h1>
        <p className="text-sm text-muted-foreground">Evolucion por ejercicio con peso y volumen.</p>
      </div>

      <ExerciseSearchSelect
        value={selectedExercise?.id ?? ""}
        selectedExercise={selectedExercise ?? undefined}
        searchExercises={(query) => api.getProgressExercises(query, 20)}
        onSelect={setSelectedExercise}
        placeholder="Selecciona un ejercicio con historial"
        emptyMessage="No hay ejercicios con historial para esa busqueda."
      />

      <Card>
        <CardContent className="p-4">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="displayDate" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Area type="monotone" dataKey="weight" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {series && (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Peso maximo" value={`${series.stats.maxWeight}kg`} hint={formatShortDate(series.stats.maxWeightDate)} />
          <MetricCard label="Peso minimo" value={`${series.stats.minWeight}kg`} hint={formatShortDate(series.stats.minWeightDate)} />
          <MetricCard label="Volumen maximo" value={String(series.stats.maxVolume)} hint={formatShortDate(series.stats.maxVolumeDate)} />
          <MetricCard label="Cambio neto" value={`${series.stats.netChange >= 0 ? "+" : ""}${series.stats.netChange}kg`} hint={`${series.stats.totalSessions} sesiones`} />
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
