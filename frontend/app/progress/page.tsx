"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ExerciseDTO, ProgressSeriesDTO } from "@my-progress/shared"
import { AppLoadingIndicator } from "@/components/app-loading-indicator"
import { ExerciseSearchSelect } from "@/components/exercise-search-select"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { api } from "@/lib/api"
import { formatShortDate, formatWeight } from "@/lib/format"

type ProgressMetric = "weight" | "volume" | "reps"

export default function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDTO | null>(null)
  const [series, setSeries] = useState<ProgressSeriesDTO | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<ProgressMetric>("weight")
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

  const chartConfig = useMemo(() => {
    if (selectedMetric === "weight") {
      return {
        title: "Evolucion del PR",
        description: "Se usa el mayor peso levantado en ese ejercicio durante la sesion.",
        dataKey: "weight" as const,
        formatValue: (value: number) => formatWeight(value),
        formatTick: (value: number) => `${value}kg`,
      }
    }

    if (selectedMetric === "reps") {
      return {
        title: "Evolucion de las repeticiones",
        description: "Se suman las repeticiones de todas las series del ejercicio en la sesion.",
        dataKey: "reps" as const,
        formatValue: (value: number) => formatReps(value),
        formatTick: (value: number) => Math.round(value).toString(),
      }
    }

    return {
      title: "Evolucion del volumen total",
      description: "Se suma peso x repeticiones de cada serie. Al tocar un dia podes ver sus repeticiones totales.",
      dataKey: "volume" as const,
      formatValue: (value: number) => formatVolume(value),
      formatTick: (value: number) => formatVolumeTick(value),
    }
  }, [selectedMetric])

  const metricCards = useMemo(() => {
    if (!series || chartData.length === 0) {
      return null
    }

    if (selectedMetric === "weight") {
      return [
        {
          label: "PR maximo",
          value: formatWeight(series.stats.maxWeight),
          hint: formatShortDate(series.stats.maxWeightDate),
        },
        {
          label: "PR minimo",
          value: formatWeight(series.stats.minWeight),
          hint: formatShortDate(series.stats.minWeightDate),
        },
        {
          label: "Volumen maximo",
          value: formatVolume(series.stats.maxVolume),
          hint: formatShortDate(series.stats.maxVolumeDate),
        },
        {
          label: "Cambio neto",
          value: formatMetricDelta(series.stats.netChange, "weight"),
          hint: `${series.stats.totalSessions} sesiones`,
        },
      ]
    }

    if (selectedMetric === "reps") {
      const repetitions = chartData.map((point) => point.reps)
      const maxReps = Math.max(...repetitions)
      const minReps = Math.min(...repetitions)
      const maxRepsPoint = chartData.find((point) => point.reps === maxReps) ?? chartData[0]
      const minRepsPoint = chartData.find((point) => point.reps === minReps) ?? chartData[0]
      const latestPoint = chartData[chartData.length - 1]
      const netRepsChange = latestPoint.reps - chartData[0].reps

      return [
        {
          label: "Mas repeticiones",
          value: formatReps(maxReps),
          hint: `${maxRepsPoint.sets} series · ${formatShortDate(maxRepsPoint.date)}`,
        },
        {
          label: "Menos repeticiones",
          value: formatReps(minReps),
          hint: `${minRepsPoint.sets} series · ${formatShortDate(minRepsPoint.date)}`,
        },
        {
          label: "Ultima sesion",
          value: formatReps(latestPoint.reps),
          hint: `${latestPoint.sets} series · ${formatShortDate(latestPoint.date)}`,
        },
        {
          label: "Cambio neto",
          value: formatMetricDelta(netRepsChange, "reps"),
          hint: `${series.stats.totalSessions} sesiones`,
        },
      ]
    }

    const volumes = chartData.map((point) => point.volume)
    const maxVolume = Math.max(...volumes)
    const minVolume = Math.min(...volumes)
    const maxVolumePoint = chartData.find((point) => point.volume === maxVolume) ?? chartData[0]
    const minVolumePoint = chartData.find((point) => point.volume === minVolume) ?? chartData[0]
    const netVolumeChange = chartData[chartData.length - 1].volume - chartData[0].volume
    const latestPoint = chartData[chartData.length - 1]

    return [
      {
        label: "Volumen maximo",
        value: formatVolume(maxVolume),
        hint: `${maxVolumePoint.reps} reps · ${formatShortDate(maxVolumePoint.date)}`,
      },
      {
        label: "Volumen minimo",
        value: formatVolume(minVolume),
        hint: `${minVolumePoint.reps} reps · ${formatShortDate(minVolumePoint.date)}`,
      },
      {
        label: "Ultima sesion",
        value: `${latestPoint.reps} reps`,
        hint: `${latestPoint.sets} series · ${formatShortDate(latestPoint.date)}`,
      },
      {
        label: "Cambio neto",
        value: formatMetricDelta(netVolumeChange, "volume"),
        hint: `${series.stats.totalSessions} sesiones`,
      },
    ]
  }, [chartData, selectedMetric, series])

  if (isLoading) {
    return <AppLoadingIndicator label="Verificando sesion..." />
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Progreso</h1>
        <p className="text-sm text-muted-foreground">Elegi ver el progreso por PR o por volumen total del ejercicio.</p>
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
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={selectedMetric === "weight" ? "default" : "outline"}
              onClick={() => setSelectedMetric("weight")}
            >
              Ver PR
            </Button>
            <Button
              type="button"
              variant={selectedMetric === "volume" ? "default" : "outline"}
              onClick={() => setSelectedMetric("volume")}
            >
              Ver volumen total
            </Button>
            <Button
              type="button"
              variant={selectedMetric === "reps" ? "default" : "outline"}
              onClick={() => setSelectedMetric("reps")}
            >
              Ver repeticiones
            </Button>
          </div>

          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{chartConfig.title}</p>
              <p className="text-xs text-muted-foreground">{chartConfig.description}</p>
            </div>
            <p className="text-xs text-muted-foreground">{chartData.length} sesiones</p>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="displayDate" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={chartConfig.formatTick} />
                <Tooltip
                  formatter={(value) => chartConfig.formatValue(Number(value))}
                  labelFormatter={(label, payload) => {
                    const point = payload?.[0]?.payload
                    if (!point?.date) return label

                    const date = new Date(point.date).toLocaleDateString("es-AR")
                    return selectedMetric === "volume" ? `${date} · ${point.reps} reps` : date
                  }}
                  contentStyle={{
                    borderRadius: "12px",
                    borderColor: "var(--color-border)",
                    backgroundColor: "var(--color-card)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartConfig.dataKey}
                  stroke="var(--color-primary)"
                  fill="var(--color-primary)"
                  fillOpacity={0.18}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {metricCards && (
        <div className="grid grid-cols-2 gap-3">
          {metricCards.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
          ))}
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

function formatVolume(volume: number) {
  return `${Math.round(volume).toLocaleString()} kg`
}

function formatVolumeTick(volume: number) {
  if (Math.abs(volume) >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`
  }

  return Math.round(volume).toString()
}

function formatReps(reps: number) {
  return `${Math.round(reps)} reps`
}

function formatMetricDelta(value: number, metric: ProgressMetric) {
  const prefix = value >= 0 ? "+" : ""
  if (metric === "weight") {
    return `${prefix}${formatWeight(value)}`
  }

  return metric === "volume" ? `${prefix}${formatVolume(value)}` : `${prefix}${formatReps(value)}`
}
