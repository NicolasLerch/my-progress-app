"use client"

import { 
  User,
  Trophy,
  Dumbbell,
  Calendar,
  Flame,
  TrendingUp,
  Settings,
  ChevronRight,
  Moon,
  Bell,
  HelpCircle,
  LogOut,
  Crown
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { mockUser, mockStats, mockPersonalRecords } from "@/lib/mock-data"

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`
  }
  return `${weight.toLocaleString()}kg`
}

export function ProfileScreen() {
  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Profile Header */}
      <Card className="bg-card border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {/* Background gradient */}
          <div className="h-20 bg-gradient-to-r from-primary/20 to-primary/5" />
          
          {/* Profile Info */}
          <div className="px-4 pb-4 -mt-10">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-full bg-card border-4 border-card flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {mockUser.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 pb-1">
                <h1 className="text-xl font-bold text-foreground">{mockUser.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Miembro desde {new Date(mockUser.memberSince).toLocaleDateString("es-ES", {
                    month: "long",
                    year: "numeric"
                  })}
                </p>
              </div>
            </div>

            {/* Physical Stats */}
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div>
                <span className="text-muted-foreground">Altura</span>
                <p className="font-semibold text-foreground">{mockUser.height} cm</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-muted-foreground">Peso</span>
                <p className="font-semibold text-foreground">{mockUser.weight} kg</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-muted-foreground">Edad</span>
                <p className="font-semibold text-foreground">{mockUser.age} años</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Resumen de estadísticas</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{mockStats.totalWorkouts}</p>
                <p className="text-xs text-muted-foreground">Entrenamientos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{mockStats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">Racha actual</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatWeight(mockStats.totalWeightLifted)}</p>
                <p className="text-xs text-muted-foreground">Peso total</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{mockStats.daysTrainedThisMonth}</p>
                <p className="text-xs text-muted-foreground">Días este mes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Personal Records */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Récords personales</h2>
          <button className="text-xs text-primary font-medium flex items-center gap-0.5">
            Ver todos
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <Card className="bg-card border-border/50">
          <CardContent className="p-0 divide-y divide-border/50">
            {mockPersonalRecords.slice(0, 4).map((record, index) => (
              <div key={index} className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{record.exercise}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(record.date).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}
                  </p>
                </div>
                <p className="text-lg font-bold text-primary">
                  {record.weight}kg
                  {record.notes && <span className="text-xs text-muted-foreground ml-1">{record.notes}</span>}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Configuración</h2>
        <Card className="bg-card border-border/50">
          <CardContent className="p-0 divide-y divide-border/50">
            {/* Dark Mode */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <Moon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Modo oscuro</p>
                  <p className="text-xs text-muted-foreground">Siempre activo</p>
                </div>
              </div>
              <Switch checked={true} />
            </div>

            {/* Notifications */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Notificaciones</p>
                  <p className="text-xs text-muted-foreground">Recordatorios de entrenamiento</p>
                </div>
              </div>
              <Switch checked={true} />
            </div>

            {/* Help */}
            <button className="p-4 flex items-center justify-between w-full hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Ayuda y soporte</p>
                  <p className="text-xs text-muted-foreground">Preguntas frecuentes</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Logout */}
            <button className="p-4 flex items-center gap-3 w-full hover:bg-secondary/50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <LogOut className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-sm font-medium text-destructive">Cerrar sesión</p>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* App Version */}
      <p className="text-center text-xs text-muted-foreground">
        My Progress v1.0.0
      </p>
    </div>
  )
}
