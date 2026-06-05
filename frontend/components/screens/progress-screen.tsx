"use client"

import { useState, useMemo } from "react"
import { 
  TrendingUp, 
  TrendingDown,
  Trophy,
  Calendar,
  ChevronDown,
  Target,
  BarChart3
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  type ChartConfig 
} from "@/components/ui/chart"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { mockExerciseHistory, allExercises } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const chartConfig = {
  weight: {
    label: "Peso (kg)",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig

export function ProgressScreen() {
  const exercisesWithHistory = Object.keys(mockExerciseHistory)
  const [selectedExercise, setSelectedExercise] = useState(exercisesWithHistory[0])
  
  const exerciseData = mockExerciseHistory[selectedExercise as keyof typeof mockExerciseHistory]
  
  const chartData = useMemo(() => {
    if (!exerciseData) return []
    return exerciseData.records.map((record) => ({
      date: record.date,
      weight: record.weight,
      reps: record.reps,
      displayDate: new Date(record.date).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      }),
    }))
  }, [exerciseData])

  const stats = useMemo(() => {
    if (!exerciseData || chartData.length === 0) return null
    
    const weights = chartData.map((d) => d.weight)
    const maxWeight = Math.max(...weights)
    const minWeight = Math.min(...weights)
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length
    
    // Calculate recent trend (last 4 workouts vs previous 4)
    const recentWorkouts = weights.slice(-4)
    const previousWorkouts = weights.slice(-8, -4)
    
    let trend = 0
    if (recentWorkouts.length > 0 && previousWorkouts.length > 0) {
      const recentAvg = recentWorkouts.reduce((a, b) => a + b, 0) / recentWorkouts.length
      const previousAvg = previousWorkouts.reduce((a, b) => a + b, 0) / previousWorkouts.length
      trend = ((recentAvg - previousAvg) / previousAvg) * 100
    }
    
    // Find best performance date
    const bestRecord = chartData.find((d) => d.weight === maxWeight)
    
    return {
      maxWeight,
      minWeight,
      avgWeight: avgWeight.toFixed(1),
      trend: trend.toFixed(1),
      bestDate: bestRecord?.date || "",
      totalSessions: chartData.length,
      personalRecord: exerciseData.personalRecord,
    }
  }, [exerciseData, chartData])

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Tu progreso</h1>
        <p className="text-sm text-muted-foreground">
          Visualiza tu evolución en cada ejercicio
        </p>
      </div>

      {/* Exercise Selector */}
      <Select value={selectedExercise} onValueChange={setSelectedExercise}>
        <SelectTrigger className="w-full bg-card border-border/50 h-12">
          <SelectValue placeholder="Selecciona un ejercicio" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border max-h-64">
          {exercisesWithHistory.map((exercise) => (
            <SelectItem key={exercise} value={exercise} className="cursor-pointer">
              {exercise}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Personal Record Banner */}
      {stats && (
        <Card className="bg-gradient-to-r from-primary/15 to-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-primary font-medium uppercase tracking-wider">
                Récord Personal
              </p>
              <p className="text-2xl font-bold text-foreground">
                {stats.personalRecord}kg
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Alcanzado el</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(stats.bestDate).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Evolución del peso
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{chartData.length} sesiones</span>
            </div>
          </div>
          
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="var(--color-border)" 
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis 
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                domain={["dataMin - 5", "dataMax + 5"]}
                tickFormatter={(value) => `${value}kg`}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value, name, item) => (
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">{value}kg</span>
                        <span className="text-muted-foreground">{item.payload.reps} reps</span>
                      </div>
                    )}
                  />
                } 
              />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#weightGradient)"
                dot={false}
                activeDot={{ 
                  r: 5, 
                  fill: "var(--color-primary)",
                  stroke: "var(--color-background)",
                  strokeWidth: 2
                }}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peso máximo</p>
                  <p className="text-lg font-bold text-foreground">{stats.maxWeight}kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peso mínimo</p>
                  <p className="text-lg font-bold text-foreground">{stats.minWeight}kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Target className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Promedio</p>
                  <p className="text-lg font-bold text-foreground">{stats.avgWeight}kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  parseFloat(stats.trend) >= 0 
                    ? "bg-emerald-500/15" 
                    : "bg-red-500/15"
                )}>
                  {parseFloat(stats.trend) >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tendencia</p>
                  <p className={cn(
                    "text-lg font-bold",
                    parseFloat(stats.trend) >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {parseFloat(stats.trend) >= 0 ? "+" : ""}{stats.trend}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions count */}
      {stats && (
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Total de sesiones registradas
              </p>
              <p className="text-xs text-muted-foreground">
                Desde {new Date(chartData[0]?.date).toLocaleDateString("es-ES", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.totalSessions}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
