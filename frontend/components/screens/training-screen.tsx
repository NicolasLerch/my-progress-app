"use client"

import { useState } from "react"
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Plus, 
  Minus, 
  Clock, 
  History,
  MessageSquare,
  X,
  Play,
  Pause
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { mockActivePlan, mockExerciseHistory } from "@/lib/mock-data"

interface SetData {
  weight: string
  reps: string
  completed: boolean
}

interface ExerciseState {
  expanded: boolean
  sets: SetData[]
  notes: string
}

export function TrainingScreen() {
  const todayWorkout = mockActivePlan.days[mockActivePlan.currentDay - 1]
  const [isWorkoutActive, setIsWorkoutActive] = useState(false)
  const [workoutTime, setWorkoutTime] = useState(0)
  const [exerciseStates, setExerciseStates] = useState<Record<string, ExerciseState>>(
    () => {
      const initial: Record<string, ExerciseState> = {}
      todayWorkout.exercises.forEach((exercise) => {
        initial[exercise.id] = {
          expanded: false,
          sets: Array(exercise.targetSets).fill(null).map(() => ({
            weight: "",
            reps: "",
            completed: false,
          })),
          notes: "",
        }
      })
      return initial
    }
  )

  // Timer effect
  useState(() => {
    let interval: NodeJS.Timeout
    if (isWorkoutActive) {
      interval = setInterval(() => {
        setWorkoutTime((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  })

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const toggleExpand = (exerciseId: string) => {
    setExerciseStates((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        expanded: !prev[exerciseId].expanded,
      },
    }))
  }

  const updateSet = (
    exerciseId: string,
    setIndex: number,
    field: "weight" | "reps",
    value: string
  ) => {
    setExerciseStates((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        sets: prev[exerciseId].sets.map((set, i) =>
          i === setIndex ? { ...set, [field]: value } : set
        ),
      },
    }))
  }

  const toggleSetComplete = (exerciseId: string, setIndex: number) => {
    setExerciseStates((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        sets: prev[exerciseId].sets.map((set, i) =>
          i === setIndex ? { ...set, completed: !set.completed } : set
        ),
      },
    }))
  }

  const addSet = (exerciseId: string) => {
    setExerciseStates((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        sets: [...prev[exerciseId].sets, { weight: "", reps: "", completed: false }],
      },
    }))
  }

  const removeSet = (exerciseId: string, setIndex: number) => {
    setExerciseStates((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        sets: prev[exerciseId].sets.filter((_, i) => i !== setIndex),
      },
    }))
  }

  const getLastWorkout = (exerciseName: string) => {
    const history = mockExerciseHistory[exerciseName as keyof typeof mockExerciseHistory]
    return history?.lastWorkout || null
  }

  const completedExercises = todayWorkout.exercises.filter((exercise) => {
    const state = exerciseStates[exercise.id]
    return state?.sets.every((set) => set.completed)
  }).length

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{todayWorkout.name}</h1>
            <p className="text-sm text-muted-foreground">
              {mockActivePlan.name} · Día {mockActivePlan.currentDay}
            </p>
          </div>
          {isWorkoutActive && (
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-mono font-semibold text-primary">
                {formatTime(workoutTime)}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(completedExercises / todayWorkout.exercises.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {completedExercises}/{todayWorkout.exercises.length}
          </span>
        </div>
      </div>

      {/* Start/Pause Workout Button */}
      {!isWorkoutActive ? (
        <Button 
          onClick={() => setIsWorkoutActive(true)}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 gap-2"
        >
          <Play className="w-4 h-4 fill-current" />
          Iniciar entrenamiento
        </Button>
      ) : (
        <Button 
          onClick={() => setIsWorkoutActive(false)}
          variant="outline"
          className="w-full h-11 gap-2 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Pause className="w-4 h-4" />
          Pausar entrenamiento
        </Button>
      )}

      {/* Exercises */}
      <div className="flex flex-col gap-3">
        {todayWorkout.exercises.map((exercise, exerciseIndex) => {
          const state = exerciseStates[exercise.id]
          const lastWorkout = getLastWorkout(exercise.name)
          const allSetsCompleted = state?.sets.every((set) => set.completed)
          
          return (
            <Card 
              key={exercise.id} 
              className={cn(
                "bg-card border-border/50 transition-all duration-200",
                allSetsCompleted && "border-primary/30 bg-primary/5"
              )}
            >
              <CardContent className="p-0">
                {/* Exercise Header */}
                <button
                  onClick={() => toggleExpand(exercise.id)}
                  className="w-full p-4 flex items-center gap-3"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0",
                    allSetsCompleted 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-secondary text-muted-foreground"
                  )}>
                    {allSetsCompleted ? <Check className="w-4 h-4" /> : exerciseIndex + 1}
                  </div>
                  
                  <div className="flex-1 text-left">
                    <p className={cn(
                      "font-medium",
                      allSetsCompleted && "text-primary"
                    )}>
                      {exercise.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {exercise.targetSets} series × {exercise.targetReps} reps · {exercise.rest}s descanso
                    </p>
                  </div>

                  {state?.expanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                {/* Expanded Content */}
                {state?.expanded && (
                  <div className="px-4 pb-4 border-t border-border/50">
                    {/* Last Workout Info */}
                    {lastWorkout && (
                      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                        <History className="w-3.5 h-3.5" />
                        <span>
                          Último: <span className="text-foreground font-medium">{lastWorkout.weight}kg × {lastWorkout.reps}</span>
                        </span>
                      </div>
                    )}

                    {/* Sets Table */}
                    <div className="flex flex-col gap-2 mt-2">
                      {/* Header */}
                      <div className="grid grid-cols-[40px_1fr_1fr_44px] gap-2 text-xs text-muted-foreground font-medium px-1">
                        <span>Serie</span>
                        <span>Peso (kg)</span>
                        <span>Reps</span>
                        <span></span>
                      </div>

                      {/* Sets */}
                      {state.sets.map((set, setIndex) => (
                        <div 
                          key={setIndex}
                          className={cn(
                            "grid grid-cols-[40px_1fr_1fr_44px] gap-2 items-center",
                            set.completed && "opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-center">
                            <span className={cn(
                              "text-sm font-medium w-6 h-6 rounded-full flex items-center justify-center",
                              set.completed 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-secondary text-muted-foreground"
                            )}>
                              {setIndex + 1}
                            </span>
                          </div>
                          
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder={lastWorkout ? String(lastWorkout.weight) : "0"}
                            value={set.weight}
                            onChange={(e) => updateSet(exercise.id, setIndex, "weight", e.target.value)}
                            className="h-10 bg-secondary border-0 text-center font-medium"
                            disabled={set.completed}
                          />
                          
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder={String(exercise.targetReps)}
                            value={set.reps}
                            onChange={(e) => updateSet(exercise.id, setIndex, "reps", e.target.value)}
                            className="h-10 bg-secondary border-0 text-center font-medium"
                            disabled={set.completed}
                          />
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleSetComplete(exercise.id, setIndex)}
                              className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                set.completed 
                                  ? "bg-primary text-primary-foreground" 
                                  : "bg-secondary text-muted-foreground hover:bg-primary/20 hover:text-primary"
                              )}
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add/Remove Set Buttons */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                      <button
                        onClick={() => addSet(exercise.id)}
                        className="flex items-center gap-1.5 text-xs text-primary font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Añadir serie
                      </button>
                      
                      {state.sets.length > 1 && (
                        <button
                          onClick={() => removeSet(exercise.id, state.sets.length - 1)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Minus className="w-4 h-4" />
                          Quitar serie
                        </button>
                      )}
                    </div>

                    {/* Rest Timer Hint */}
                    <div className="flex items-center gap-2 mt-3 p-2.5 bg-secondary/50 rounded-lg">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Descanso recomendado: <span className="text-foreground font-medium">{exercise.rest}s</span>
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Finish Workout Button */}
      {isWorkoutActive && completedExercises === todayWorkout.exercises.length && (
        <Button 
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 gap-2 mt-2"
        >
          <Check className="w-5 h-5" />
          Finalizar entrenamiento
        </Button>
      )}
    </div>
  )
}
