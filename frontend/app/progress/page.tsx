"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type {
  ExerciseDTO,
  OverallProgressAnalysisDTO,
  ProgressAnalysisDTO,
  ProgressMetricAnalysisDTO,
  ProgressPointDTO,
  ProgressSeriesDTO,
  ProgressStatus,
} from "@my-progress/shared"
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
type AnalysisMetricKey = "pr" | "volume" | "repetitions"
type MetricCardData = {
  label: string
  value: string
  hint: string
  status?: ProgressStatus
  accentColor?: string
  wide?: boolean
}

const METRICS: Record<ProgressMetric, {
  label: string
  dataKey: "weight" | "volume" | "reps"
  indexKey: "weightIndex" | "volumeIndex" | "repsIndex"
  analysisKey: AnalysisMetricKey
  color: string
  formatValue: (value: number) => string
}> = {
  weight: {
    label: "PR",
    dataKey: "weight",
    indexKey: "weightIndex",
    analysisKey: "pr",
    color: "#ea580c",
    formatValue: formatWeight,
  },
  volume: {
    label: "Volumen",
    dataKey: "volume",
    indexKey: "volumeIndex",
    analysisKey: "volume",
    color: "#2563eb",
    formatValue: formatVolume,
  },
  reps: {
    label: "Repeticiones",
    dataKey: "reps",
    indexKey: "repsIndex",
    analysisKey: "repetitions",
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
    if (!series || rawChartData.length === 0) {
      return null
    }

    const latestPoint = rawChartData[rawChartData.length - 1]
    const analysis = series.analysis

    if (selectedMetric) {
      const config = METRICS[selectedMetric]
      const metricAnalysis = analysis[config.analysisKey]
      return [
        {
          label: lastMetricLabel(selectedMetric),
          value: config.formatValue(metricAnalysis.current),
          hint: formatShortDate(latestPoint.date),
          accentColor: config.color,
        },
        {
          label: maxMetricLabel(selectedMetric),
          value: config.formatValue(metricAnalysis.max),
          hint: formatShortDate(metricAnalysis.maxDate),
          accentColor: config.color,
        },
        analysisCard("Progreso desde el inicio", metricAnalysis.historical, "Primeras 3 vs ultimas 3", analysis),
        analysisCard("Tendencia reciente", metricAnalysis.recent, "Ultimas 6 sesiones", analysis),
      ]
    }

    const comparisonCards = visibleMetrics.map((metric) => {
      const config = METRICS[metric]
      return analysisCard(config.label, analysis[config.analysisKey].historical, "Progreso desde el inicio", analysis, config.color)
    })
    const overallCard = analysisCard("General", analysis.overall.historical, "PR, volumen y repeticiones", analysis)

    return [...comparisonCards, { ...overallCard, wide: comparisonCards.length === 2 }]
  }, [rawChartData, selectedMetric, series, visibleMetrics])

  const analysisSummary = useMemo(
    () => series ? buildAnalysisSummary(series.analysis, visibleMetrics) : null,
    [series, visibleMetrics],
  )

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
            <MetricCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {analysisSummary && (
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-sm font-medium">Resumen del analisis</p>
            {analysisSummary.map((line) => (
              <p key={line} className="text-sm text-muted-foreground">{line}</p>
            ))}
          </CardContent>
        </Card>
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

function analysisCard(
  label: string,
  change: { changePercent: number; status: ProgressStatus } | OverallProgressAnalysisDTO | undefined,
  hint: string,
  analysis: ProgressAnalysisDTO,
  accentColor?: string,
): MetricCardData {
  if (change) {
    return {
      label,
      value: formatPercent("changePercent" in change ? change.changePercent : change.score),
      hint,
      status: change.status,
      accentColor,
    }
  }

  if (!analysis.canAnalyzeProgress) {
    return {
      label,
      value: `Faltan ${analysis.sessionsRemaining} ${sessionLabel(analysis.sessionsRemaining)}`,
      hint: `Analisis disponible con ${analysis.sessionsRequired} sesiones`,
      accentColor,
    }
  }

  return {
    label,
    value: "Sin datos comparables",
    hint: "Hace falta una base de valor positiva",
    accentColor,
  }
}

function buildAnalysisSummary(analysis: ProgressAnalysisDTO, visibleMetrics: ProgressMetric[]): string[] {
  if (!analysis.canAnalyzeProgress) {
    return [`Necesitas ${analysis.sessionsRemaining} ${sessionLabel(analysis.sessionsRemaining)} mas para analizar tu progreso.`]
  }

  if (visibleMetrics.length === 1) {
    const metric = visibleMetrics[0]
    const metricAnalysis = analysis[METRICS[metric].analysisKey]
    if (!metricAnalysis.historical) {
      return [`No hay datos suficientes de ${METRICS[metric].label.toLowerCase()} para generar un analisis formal.`]
    }

    const lines = [metricHistoricalSummary(METRICS[metric].label, metricAnalysis.historical.status)]
    if (metricAnalysis.recent) {
      lines.push(metricRecentSummary(METRICS[metric].label, metricAnalysis.recent.status))
    }
    return lines
  }

  const historical = analysis.overall.historical
  if (!historical) {
    return ["No hay datos suficientes de las tres metricas para generar un analisis general."]
  }

  const lines = [historicalSummary(historical.status)]
  if (analysis.overall.recent) {
    lines.push(recentSummary(analysis.overall.recent.status))
  }

  const mostImproved = visibleMetrics
    .map((metric) => ({ metric, change: analysis[METRICS[metric].analysisKey].historical }))
    .filter((item): item is { metric: ProgressMetric; change: { changePercent: number; status: ProgressStatus } } => Boolean(item.change))
    .reduce<{ metric: ProgressMetric; change: { changePercent: number; status: ProgressStatus } } | undefined>(
      (best, item) => !best || item.change.changePercent > best.change.changePercent ? item : best,
      undefined,
    )

  if (mostImproved && mostImproved.change.changePercent > 0) {
    lines.push(`${METRICS[mostImproved.metric].label} es la metrica que mas mejoro (${formatPercent(mostImproved.change.changePercent)}).`)
  }

  return lines
}

function ProgressStatusLabel({ status }: { status: ProgressStatus }) {
  const content = {
    positive: { label: "Positiva", icon: ArrowUp, className: "text-emerald-500" },
    maintenance: { label: "Mantenimiento", icon: ArrowRight, className: "text-muted-foreground" },
    negative: { label: "Negativa", icon: ArrowDown, className: "text-red-500" },
  }[status]
  const Icon = content.icon

  return (
    <p className={`flex items-center gap-1 text-xs ${content.className}`}>
      <Icon className="size-3" />
      {content.label}
    </p>
  )
}

function MetricCard({ label, value, hint, status, accentColor, wide }: MetricCardData) {
  return (
    <Card className={wide ? "col-span-2" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground" style={accentColor ? { color: accentColor } : undefined}>{label}</p>
        <p className="text-lg font-bold">{value}</p>
        {status ? <ProgressStatusLabel status={status} /> : <p className="text-xs text-muted-foreground">{hint}</p>}
        {status && <p className="text-xs text-muted-foreground">{hint}</p>}
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

function formatPercent(value: number) {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`
}

function lastMetricLabel(metric: ProgressMetric) {
  return metric === "weight" ? "Ultimo PR" : metric === "volume" ? "Ultimo volumen" : "Ultimas repeticiones"
}

function maxMetricLabel(metric: ProgressMetric) {
  return metric === "weight" ? "Mejor PR" : metric === "volume" ? "Volumen maximo" : "Maximo de repeticiones"
}

function sessionLabel(count: number) {
  return count === 1 ? "sesion" : "sesiones"
}

function historicalSummary(status: ProgressStatus) {
  if (status === "positive") {
    return "Tendencia general positiva. Tu rendimiento es superior al de tus primeras sesiones."
  }
  if (status === "negative") {
    return "Tu rendimiento general se encuentra por debajo de tus primeras sesiones."
  }
  return "Tu rendimiento general se mantiene estable respecto de tus primeras sesiones."
}

function recentSummary(status: ProgressStatus) {
  if (status === "positive") {
    return "Tus ultimas sesiones muestran una evolucion positiva."
  }
  if (status === "negative") {
    return "Tus ultimas sesiones muestran una caida de rendimiento."
  }
  return "Tu rendimiento reciente se mantiene estable."
}

function metricHistoricalSummary(label: string, status: ProgressStatus) {
  if (status === "positive") {
    return `Tu progreso de ${label.toLowerCase()} es positivo respecto de tus primeras sesiones.`
  }
  if (status === "negative") {
    return `Tu ${label.toLowerCase()} esta por debajo de tus primeras sesiones.`
  }
  return `Tu ${label.toLowerCase()} se mantiene estable respecto de tus primeras sesiones.`
}

function metricRecentSummary(label: string, status: ProgressStatus) {
  if (status === "positive") {
    return `Tus ultimas sesiones muestran una evolucion positiva de ${label.toLowerCase()}.`
  }
  if (status === "negative") {
    return `Tus ultimas sesiones muestran una caida de ${label.toLowerCase()}.`
  }
  return `Tu ${label.toLowerCase()} reciente se mantiene estable.`
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
