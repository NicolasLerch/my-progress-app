"use client"

import { Flame, Dumbbell, Trophy, Calendar, ChevronRight, Play, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { mockUser, mockStats, mockActivePlan, mockRecentActivity } from "@/lib/mock-data"

interface HomeScreenProps {
  onStartWorkout: () => void
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`
  }
  return `${weight.toLocaleString()}kg`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const diffTime = today.getTime() - date.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return "Hoy"
  if (diffDays === 1) return "Ayer"
  if (diffDays < 7) return `Hace ${diffDays} días`
  
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
}

export function HomeScreen({ onStartWorkout }: HomeScreenProps) {
  const todayWorkout = mockActivePlan.days[mockActivePlan.currentDay - 1]
  
  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Header with greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Bienvenido de nuevo</p>
          <h1 className="text-2xl font-bold text-foreground">{mockUser.name}</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-semibold text-lg">
            {mockUser.name.charAt(0)}
          </span>
        </div>
      </div>

      {/* Active Plan Badge */}
      <Card className="bg-secondary/50 border-border/50">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Plan activo</p>
            <p className="text-sm font-medium text-foreground">{mockActivePlan.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Día</p>
            <p className="text-sm font-semibold text-primary">{mockActivePlan.currentDay}/{mockActivePlan.totalDays}</p>
          </div>
        </CardContent>
      </Card>

      {/* Today's Workout Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 overflow-hidden relative">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-primary font-medium uppercase tracking-wider">
                Entrenamiento de hoy
              </p>
              <h2 className="text-xl font-bold text-foreground mt-1">
                {todayWorkout.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {todayWorkout.exercises.length} ejercicios
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {todayWorkout.exercises.slice(0, 3).map((exercise) => (
                <span 
                  key={exercise.id}
                  className="text-xs px-2.5 py-1 bg-card/80 rounded-full text-muted-foreground"
                >
                  {exercise.name}
                </span>
              ))}
              {todayWorkout.exercises.length > 3 && (
                <span className="text-xs px-2.5 py-1 bg-card/80 rounded-full text-muted-foreground">
                  +{todayWorkout.exercises.length - 3} más
                </span>
              )}
            </div>

            <Button 
              onClick={onStartWorkout}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              Comenzar entrenamiento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Estadísticas rápidas</h3>
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card border-border/50">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center mb-2">
                <Dumbbell className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">{mockStats.totalWorkouts}</p>
              <p className="text-[10px] text-muted-foreground">Entrenamientos</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="w-9 h-9 rounded-full bg-orange-500/15 flex items-center justify-center mb-2">
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{mockStats.currentStreak}</p>
              <p className="text-[10px] text-muted-foreground">Racha días</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center mb-2">
                <Trophy className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{formatWeight(mockStats.totalWeightLifted)}</p>
              <p className="text-[10px] text-muted-foreground">Peso total</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Actividad reciente</h3>
          <button className="text-xs text-primary font-medium flex items-center gap-0.5">
            Ver todo
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        
        <div className="flex flex-col gap-2">
          {mockRecentActivity.map((activity) => (
            <Card key={activity.id} className="bg-card border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activity.dayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(activity.date)} · {activity.exercises} ejercicios
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{activity.duration}min</span>
                    </div>
                    <p className="text-xs text-primary font-medium">
                      {formatWeight(activity.totalVolume)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
