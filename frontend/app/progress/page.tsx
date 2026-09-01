"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ExerciseDTO, ProgressPointDTO, ProgressSeriesDTO } from "@my-progress/shared"
import { AppLoadingIndicator } from "@/components/app-loading-indicator"
import { ExerciseSearchSelect } from "@/components/exercise-search-select"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { api } from "@/lib/api"
import { formatShortDate, formatWeight } from "@/lib/format"

type ProgressMetric = "weight" | "volume" | "reps"
type ChartPoint = ProgressPointDTO & {
  displayDate: string
  weightIndex?: number
  volumeIndex?: number
  repsIndex?: number
}

const METRICS: Record<ProgressMetric, {
  label: string
  dataKey: "weight" | "volume" | "reps"
  indexKey: "weightIndex" | "volumeIndex" | "repsIndex"
  color: string
  formatValue: (value: number) => string
}> = {
  weight: {
    label: "PR",
    dataKey: "weight",
    indexKey: "weightIndex",
    color: "#ea580c",
    formatValue: formatWeight,
  },
  volume: {
    label: "Volumen",
    dataKey: "volume",
    indexKey: "volumeIndex",
    color: "#2563eb",
    formatValue: formatVolume,
  },
  reps: {
    label: "Repeticiones",
    dataKey: "reps",
    indexKey: "repsIndex",
    color: "#16a34a",
    formatValue: formatReps,
  },
}

export default function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDTO | null>(null)
  const [series, setSeries] = useState<ProgressSeriesDTO | null>(null)
  const [activeMetrics, setActiveMetrics] = useState<ProgressMetric[]>(["weight"])
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

  const rawChartData = useMemo(
    () => series?.points.map((point) => ({ ...point, displayDate: formatShortDate(point.date) })) ?? [],
    [series],
  )

  const metricBaselines = useMemo(() => {
    return (Object.keys(METRICS) as ProgressMetric[]).reduce<Record<ProgressMetric, number | undefined>>(
      (baselines, metric) => {
        baselines[metric] = rawChartData.find((point) => point[METRICS[metric].dataKey] > 0)?.[METRICS[metric].dataKey]
        return baselines
      },
      { weight: undefined, volume: undefined, reps: undefined },
    )
  }, [rawChartData])

  const isComparing = activeMetrics.length > 1
  const visibleMetrics = isComparing
    ? activeMetrics.filter((metric) => metricBaselines[metric] !== undefined)
    : activeMetrics
  const unavailableMetrics = isComparing
    ? activeMetrics.filter((metric) => metricBaselines[metric] === undefined)
    : []

  const chartData = useMemo<ChartPoint[]>(() => {
    return rawChartData.map((point) => {
      const indexedPoint: ChartPoint = { ...point }
      if (!isComparing) {
        return indexedPoint
      }

      for (const metric of visibleMetrics) {
        const config = METRICS[metric]
        const baseline = metricBaselines[metric]
        if (baseline) {
          indexedPoint[config.indexKey] = (point[config.dataKey] / baseline) * 100
        }
      }
      return indexedPoint
    })
  }, [isComparing, metricBaselines, rawChartData, visibleMetrics])

  const selectedMetric = activeMetrics.length === 1 ? activeMetrics[0] : null
  const metricCards = useMemo(() => {
    if (!series || rawChartData.length === 0 || !selectedMetric) {
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
      const repetitions = rawChartData.map((point) => point.reps)
      const maxReps = Math.max(...repetitions)
      const minReps = Math.min(...repetitions)
      const maxRepsPoint = rawChartData.find((point) => point.reps === maxReps) ?? rawChartData[0]
      const minRepsPoint = rawChartData.find((point) => point.reps === minReps) ?? rawChartData[0]
      const latestPoint = rawChartData[rawChartData.length - 1]

      return [
        {
          label: "Mas repeticiones",
          value: formatReps(maxReps),
          hint: `${maxRepsPoint.sets} series - ${formatShortDate(maxRepsPoint.date)}`,
        },
        {
          label: "Menos repeticiones",
          value: formatReps(minReps),
          hint: `${minRepsPoint.sets} series - ${formatShortDate(minRepsPoint.date)}`,
        },
        {
          label: "Ultima sesion",
          value: formatReps(latestPoint.reps),
          hint: `${latestPoint.sets} series - ${formatShortDate(latestPoint.date)}`,
        },
        {
          label: "Cambio neto",
          value: formatMetricDelta(latestPoint.reps - rawChartData[0].reps, "reps"),
          hint: `${series.stats.totalSessions} sesiones`,
        },
      ]
    }

    const volumes = rawChartData.map((point) => point.volume)
    const maxVolume = Math.max(...volumes)
    const minVolume = Math.min(...volumes)
    const maxVolumePoint = rawChartData.find((point) => point.volume === maxVolume) ?? rawChartData[0]
    const minVolumePoint = rawChartData.find((point) => point.volume === minVolume) ?? rawChartData[0]
    const latestPoint = rawChartData[rawChartData.length - 1]

    return [
      {
        label: "Volumen maximo",
        value: formatVolume(maxVolume),
        hint: `${maxVolumePoint.reps} reps - ${formatShortDate(maxVolumePoint.date)}`,
      },
      {
        label: "Volumen minimo",
        value: formatVolume(minVolume),
        hint: `${minVolumePoint.reps} reps - ${formatShortDate(minVolumePoint.date)}`,
      },
      {
        label: "Ultima sesion",
        value: formatReps(latestPoint.reps),
        hint: `${latestPoint.sets} series - ${formatShortDate(latestPoint.date)}`,
      },
      {
        label: "Cambio neto",
        value: formatMetricDelta(latestPoint.volume - rawChartData[0].volume, "volume"),
        hint: `${series.stats.totalSessions} sesiones`,
      },
    ]
  }, [rawChartData, selectedMetric, series])

  function toggleMetric(metric: ProgressMetric) {
    setActiveMetrics((current) => {
      if (current.includes(metric)) {
        return current.length === 1 ? current : current.filter((item) => item !== metric)
      }

      return [...current, metric]
    })
  }

  if (isLoading) {
    return <AppLoadingIndicator label="Verificando sesion..." />
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Progreso</h1>
        <p className="text-sm text-muted-foreground">Compara PR, volumen y repeticiones de cada ejercicio.</p>
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
            {(Object.keys(METRICS) as ProgressMetric[]).map((metric) => {
              const config = METRICS[metric]
              const isActive = activeMetrics.includes(metric)

              return (
                <Button
                  key={metric}
                  type="button"
                  variant="outline"
                  aria-pressed={isActive}
                  onClick={() => toggleMetric(metric)}
                  style={{
                    backgroundColor: isActive ? config.color : "transparent",
                    borderColor: config.color,
                    color: isActive ? "white" : config.color,
                  }}
                >
                  {config.label}
                </Button>
              )
            })}
          </div>

          {unavailableMetrics.length > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">
              {unavailableMetrics.map((metric) => METRICS[metric].label).join(", ")} no tiene valores para graficar.
            </p>
          )}

          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{isComparing ? "Comparacion de progreso" : "Evolucion de progreso"}</p>
              <p className="text-xs text-muted-foreground">
                {isComparing
                  ? "Las curvas muestran valores relativos desde la primera sesion con valor. Toca un dia para ver los valores reales."
                  : "La curva muestra los valores reales de cada sesion."}
              </p>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">{chartData.length} sesiones</p>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="displayDate" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatAxisValue(value, activeMetrics[0] ?? "weight", isComparing)}
                />
                <Tooltip content={<ProgressTooltip visibleMetrics={visibleMetrics} />} />
                {visibleMetrics.map((metric) => {
                  const config = METRICS[metric]
                  return (
                    <Area
                      key={metric}
                      type="monotone"
                      dataKey={isComparing ? config.indexKey : config.dataKey}
                      name={config.label}
                      stroke={config.color}
                      fill={config.color}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  )
                })}
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

function ProgressTooltip({
  active,
  payload,
  visibleMetrics,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartPoint }>
  visibleMetrics: ProgressMetric[]
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <p className="mb-1 text-xs text-muted-foreground">{new Date(point.date).toLocaleDateString("es-AR")}</p>
      <div className="space-y-1">
        {visibleMetrics.map((metric) => {
          const config = METRICS[metric]
          return (
            <p key={metric} className="text-sm font-medium" style={{ color: config.color }}>
              {config.label}: {config.formatValue(point[config.dataKey])}
            </p>
          )
        })}
      </div>
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

function formatReps(reps: number) {
  return `${Math.round(reps)} reps`
}

function formatAxisValue(value: number, metric: ProgressMetric, isComparing: boolean) {
  if (isComparing) {
    return `${Math.round(value)}%`
  }

  if (metric === "weight") {
    return `${Math.round(value)}kg`
  }

  if (metric === "volume") {
    return Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : Math.round(value).toString()
  }

  return Math.round(value).toString()
}

function formatMetricDelta(value: number, metric: ProgressMetric) {
  const prefix = value >= 0 ? "+" : ""
  if (metric === "weight") {
    return `${prefix}${formatWeight(value)}`
  }

  return metric === "volume" ? `${prefix}${formatVolume(value)}` : `${prefix}${formatReps(value)}`
}
