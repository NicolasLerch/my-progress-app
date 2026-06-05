"use client"

import { useState } from "react"
import { 
  Plus, 
  Calendar,
  ChevronRight,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Archive,
  Edit,
  Trash2,
  Dumbbell
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { mockPlans, mockActivePlan } from "@/lib/mock-data"

type PlanStatus = "active" | "completed" | "archived"

interface Plan {
  id: string
  name: string
  startDate: string
  endDate: string
  status: PlanStatus
  currentDay: number
  totalDays: number
  days: Array<{
    id: string
    dayNumber: number
    name: string
    exercises: Array<{
      id: string
      name: string
      targetSets: number
      targetReps: number
      rest: number
      notes?: string
    }>
  }>
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  
  const formatOptions: Intl.DateTimeFormatOptions = { 
    day: "numeric", 
    month: "short",
    year: startDate.getFullYear() !== endDate.getFullYear() ? "numeric" : undefined
  }
  
  return `${startDate.toLocaleDateString("es-ES", formatOptions)} - ${endDate.toLocaleDateString("es-ES", { ...formatOptions, year: "numeric" })}`
}

function getStatusColor(status: PlanStatus) {
  switch (status) {
    case "active":
      return "bg-primary/15 text-primary border-primary/30"
    case "completed":
      return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
    default:
      return "bg-muted text-muted-foreground border-muted"
  }
}

function getStatusLabel(status: PlanStatus) {
  switch (status) {
    case "active":
      return "Activo"
    case "completed":
      return "Completado"
    default:
      return "Archivado"
  }
}

export function PlansScreen() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  
  const activePlans = mockPlans.filter((p) => p.status === "active")
  const completedPlans = mockPlans.filter((p) => p.status === "completed")

  if (selectedPlan) {
    return (
      <PlanDetail 
        plan={selectedPlan} 
        onBack={() => setSelectedPlan(null)} 
      />
    )
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tus planes</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tus rutinas de entrenamiento
          </p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Nuevo
        </Button>
      </div>

      {/* Active Plans */}
      {activePlans.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Planes activos
          </h2>
          <div className="flex flex-col gap-3">
            {activePlans.map((plan) => (
              <Card 
                key={plan.id}
                className="bg-card border-primary/20 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setSelectedPlan(plan as Plan)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {plan.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {formatDateRange(plan.startDate, plan.endDate)}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <Edit className="w-4 h-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <Archive className="w-4 h-4" />
                          Archivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className={getStatusColor(plan.status)}>
                        {getStatusLabel(plan.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {plan.totalDays} días de entrenamiento
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-primary">
                      <span className="text-xs font-medium">Ver detalles</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Plans */}
      {completedPlans.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Planes completados
          </h2>
          <div className="flex flex-col gap-3">
            {completedPlans.map((plan) => (
              <Card 
                key={plan.id}
                className="bg-card border-border/50 cursor-pointer hover:border-border transition-colors"
                onClick={() => setSelectedPlan(plan as Plan)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {plan.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {formatDateRange(plan.startDate, plan.endDate)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(plan.status)}>
                      {getStatusLabel(plan.status)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {mockPlans.length === 0 && (
        <Card className="bg-card border-border/50 border-dashed">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Calendar className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              No tienes planes
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crea tu primer plan de entrenamiento
            </p>
            <Button className="gap-1.5">
              <Plus className="w-4 h-4" />
              Crear plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Plan Detail View
function PlanDetail({ plan, onBack }: { plan: Plan; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <div>
        <button 
          onClick={onBack}
          className="text-sm text-primary font-medium mb-2 flex items-center gap-1"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Volver a planes
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{plan.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDateRange(plan.startDate, plan.endDate)}
            </p>
          </div>
          <Badge variant="outline" className={getStatusColor(plan.status)}>
            {getStatusLabel(plan.status)}
          </Badge>
        </div>
      </div>

      {/* Days */}
      <div className="flex flex-col gap-3">
        {plan.days.map((day) => (
          <Card key={day.id} className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold",
                  plan.currentDay === day.dayNumber 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-muted-foreground"
                )}>
                  {day.dayNumber}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{day.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {day.exercises.length} ejercicios
                  </p>
                </div>
                {plan.currentDay === day.dayNumber && (
                  <Badge className="bg-primary/15 text-primary border-0 text-xs">
                    Hoy
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {day.exercises.slice(0, 4).map((exercise) => (
                  <div 
                    key={exercise.id}
                    className="text-xs px-2 py-1 bg-secondary rounded text-muted-foreground"
                  >
                    {exercise.name}
                  </div>
                ))}
                {day.exercises.length > 4 && (
                  <div className="text-xs px-2 py-1 bg-secondary rounded text-muted-foreground">
                    +{day.exercises.length - 4} más
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2">
          <Edit className="w-4 h-4" />
          Editar plan
        </Button>
        <Button variant="outline" className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
          <Archive className="w-4 h-4" />
          Archivar
        </Button>
      </div>
    </div>
  )
}
