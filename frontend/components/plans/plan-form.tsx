'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { CreatePlanInputDTO, ExerciseDTO, PlanDTO } from '@my-progress/shared'
import { api } from '@/lib/api'
import { useAuthReady } from '@/hooks/use-auth-ready'
import { ExerciseSearchSelect } from '@/components/exercise-search-select'
import { AppLoadingIndicator } from '@/components/app-loading-indicator'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type ExerciseForm = {
  id: string
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  targetSets: string
  targetReps: string
  restSeconds: string
  notes: string
}

type DayForm = {
  id: string
  name: string
  exercises: ExerciseForm[]
}

type PlanFormValues = {
  name: string
  days: DayForm[]
}

type PlanFormProps = {
  backHref: string
  title: string
  description: string
  submitLabel: string
  submittingLabel: string
  initialPlan?: PlanDTO
  onSubmit: (values: PlanFormValues) => Promise<void>
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function createExerciseForm(defaultExercise?: Pick<ExerciseDTO, 'id' | 'name' | 'muscleGroup'>): ExerciseForm {
  return {
    id: createId('exercise'),
    exerciseId: defaultExercise?.id ?? '',
    exerciseName: defaultExercise?.name ?? '',
    muscleGroup: defaultExercise?.muscleGroup ?? '',
    targetSets: '4',
    targetReps: '8',
    restSeconds: '90',
    notes: '',
  }
}

function createDayForm(index: number, defaultExercise?: Pick<ExerciseDTO, 'id' | 'name' | 'muscleGroup'>): DayForm {
  return {
    id: createId('day'),
    name: `Dia ${index + 1}`,
    exercises: [createExerciseForm(defaultExercise)],
  }
}

function mapPlanToForm(plan: PlanDTO): PlanFormValues {
  return {
    name: plan.name,
    days: plan.days.map((day) => ({
      id: day.id,
      name: day.name,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        muscleGroup: '',
        targetSets: String(exercise.targetSets),
        targetReps: String(exercise.targetReps),
        restSeconds: String(exercise.restSeconds),
        notes: exercise.notes ?? '',
      })),
    })),
  }
}

export function parsePositiveInteger(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function parseNonNegativeInteger(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export function parseTargetReps(value: string) {
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= 30 ? normalized : null
}

export function buildPlanInput(
  values: PlanFormValues,
  options?: {
    status?: PlanDTO['status']
    startDate?: string
    endDate?: string
    currentDay?: number
  },
): CreatePlanInputDTO {
  const dayCount = values.days.length

  return {
    name: values.name.trim(),
    startDate: options?.startDate ?? new Date().toISOString(),
    endDate: options?.endDate,
    status: options?.status ?? 'active',
    currentDay: Math.min(options?.currentDay ?? 1, dayCount),
    days: values.days.map((day, dayIndex) => ({
      name: day.name.trim(),
      order: dayIndex + 1,
      exercises: day.exercises.map((exercise, exerciseIndex) => ({
        order: exerciseIndex + 1,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName.trim(),
        targetSets: parsePositiveInteger(exercise.targetSets) ?? 0,
        targetReps: parseTargetReps(exercise.targetReps) ?? '',
        restSeconds: parseNonNegativeInteger(exercise.restSeconds) ?? 0,
        notes: exercise.notes.trim() || undefined,
      })),
    })),
  }
}

export function PlanForm({
  backHref,
  title,
  description,
  submitLabel,
  submittingLabel,
  initialPlan,
  onSubmit,
}: PlanFormProps) {
  const planInputClassName =
    'border-border/70 bg-secondary/75 text-foreground placeholder:text-muted-foreground shadow-none'

  const [name, setName] = useState(initialPlan?.name ?? 'Nuevo plan')
  const [days, setDays] = useState<DayForm[]>(initialPlan ? mapPlanToForm(initialPlan).days : [createDayForm(0)])
  const [saving, setSaving] = useState(false)
  const { isLoading } = useAuthReady()

  useEffect(() => {
    if (!initialPlan) {
      return
    }

    const nextForm = mapPlanToForm(initialPlan)
    setName(nextForm.name)
    setDays(nextForm.days)
  }, [initialPlan])

  const validationErrors = useMemo(() => {
    const errors: string[] = []

    if (name.trim().length < 2) {
      errors.push('El nombre del plan debe tener al menos 2 caracteres.')
    }

    if (days.length === 0) {
      errors.push('Debes agregar al menos un dia.')
    }

    days.forEach((day, dayIndex) => {
      if (day.name.trim().length < 2) {
        errors.push(`El nombre del dia ${dayIndex + 1} debe tener al menos 2 caracteres.`)
      }

      if (day.exercises.length === 0) {
        errors.push(`El dia ${dayIndex + 1} debe tener al menos un ejercicio.`)
      }

      day.exercises.forEach((exercise, exerciseIndex) => {
        if (!exercise.exerciseId || exercise.exerciseName.trim().length < 2) {
          errors.push(`Falta seleccionar el ejercicio ${exerciseIndex + 1} del dia ${dayIndex + 1}.`)
        }

        if (parsePositiveInteger(exercise.targetSets) === null) {
          errors.push(`Las series del ejercicio ${exerciseIndex + 1} del dia ${dayIndex + 1} deben ser mayores a 0.`)
        }

        if (parseTargetReps(exercise.targetReps) === null) {
          errors.push(`Las repeticiones del ejercicio ${exerciseIndex + 1} del dia ${dayIndex + 1} no pueden quedar vacias.`)
        }

        if (parseNonNegativeInteger(exercise.restSeconds) === null) {
          errors.push(`El descanso del ejercicio ${exerciseIndex + 1} del dia ${dayIndex + 1} no puede ser negativo.`)
        }
      })
    })

    return errors
  }, [days, name])

  const canSave = !saving && validationErrors.length === 0

  function updateDay(dayId: string, updater: (day: DayForm) => DayForm) {
    setDays((currentDays) => currentDays.map((day) => (day.id === dayId ? updater(day) : day)))
  }

  function addDay() {
    setDays((currentDays) => [...currentDays, createDayForm(currentDays.length)])
  }

  function removeDay(dayId: string) {
    setDays((currentDays) => (currentDays.length === 1 ? currentDays : currentDays.filter((day) => day.id !== dayId)))
  }

  function moveDay(dayId: string, direction: 'up' | 'down') {
    setDays((currentDays) => {
      const index = currentDays.findIndex((day) => day.id === dayId)
      if (index === -1) return currentDays
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= currentDays.length) return currentDays

      const nextDays = [...currentDays]
      const [moved] = nextDays.splice(index, 1)
      nextDays.splice(targetIndex, 0, moved)
      return nextDays
    })
  }

  function addExercise(dayId: string) {
    updateDay(dayId, (day) => ({
      ...day,
      exercises: [...day.exercises, createExerciseForm()],
    }))
  }

  function removeExercise(dayId: string, exerciseId: string) {
    updateDay(dayId, (day) => ({
      ...day,
      exercises:
        day.exercises.length === 1
          ? day.exercises
          : day.exercises.filter((exercise) => exercise.id !== exerciseId),
    }))
  }

  function moveExercise(dayId: string, exerciseId: string, direction: 'up' | 'down') {
    updateDay(dayId, (day) => {
      const index = day.exercises.findIndex((exercise) => exercise.id === exerciseId)
      if (index === -1) return day
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= day.exercises.length) return day

      const exercises = [...day.exercises]
      const [moved] = exercises.splice(index, 1)
      exercises.splice(targetIndex, 0, moved)
      return { ...day, exercises }
    })
  }

  function updateExercise(
    dayId: string,
    exerciseId: string,
    updater: (exercise: ExerciseForm) => ExerciseForm,
  ) {
    updateDay(dayId, (day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => (exercise.id === exerciseId ? updater(exercise) : exercise)),
    }))
  }

  async function handleSubmit() {
    if (!canSave) {
      return
    }

    setSaving(true)

    try {
      await onSubmit({ name, days })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={backHref}>
            <ArrowLeft className="w-4 h-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-name">Nombre del plan</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej: Hipertrofia 4 dias"
              className={planInputClassName}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-4">
            <AppLoadingIndicator compact label="Verificando sesión..." />
          </CardContent>
        </Card>
      ) : null}

      {validationErrors.length > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex flex-col gap-2">
            <p className="text-sm font-medium">Faltan completar algunos datos</p>
            <ul className="list-disc pl-4 text-xs text-muted-foreground">
              {validationErrors.slice(0, 5).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
        {days.map((day, dayIndex) => (
          <Card key={day.id}>
            <CardContent className="p-4 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-primary">Dia {dayIndex + 1}</span>
                  </div>
                  <Label htmlFor={`day-name-${day.id}`}>Nombre del dia</Label>
                  <Input
                    id={`day-name-${day.id}`}
                    value={day.name}
                    onChange={(event) =>
                      updateDay(day.id, (currentDay) => ({
                        ...currentDay,
                        name: event.target.value,
                      }))
                    }
                    placeholder={`Dia ${dayIndex + 1}`}
                    className={`mt-2 ${planInputClassName}`}
                  />
                </div>
                <div className="flex items-center gap-1 pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveDay(day.id, 'up')}
                    disabled={dayIndex === 0}
                  >
                    <ArrowUp className="w-4 h-4" />
                    <span className="sr-only">Subir dia</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveDay(day.id, 'down')}
                    disabled={dayIndex === days.length - 1}
                  >
                    <ArrowDown className="w-4 h-4" />
                    <span className="sr-only">Bajar dia</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeDay(day.id)}
                    disabled={days.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="sr-only">Eliminar dia</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {day.exercises.map((exercise, exerciseIndex) => (
                  <div key={exercise.id} className="rounded-2xl border border-border/70 bg-secondary/40 p-3">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-sm font-medium">Ejercicio {exerciseIndex + 1}</p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveExercise(day.id, exercise.id, 'up')}
                          disabled={exerciseIndex === 0}
                        >
                          <ArrowUp className="w-4 h-4" />
                          <span className="sr-only">Subir ejercicio</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveExercise(day.id, exercise.id, 'down')}
                          disabled={exerciseIndex === day.exercises.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                          <span className="sr-only">Bajar ejercicio</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeExercise(day.id, exercise.id)}
                          disabled={day.exercises.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Eliminar ejercicio</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <Label>Ejercicio</Label>
                        <ExerciseSearchSelect
                          value={exercise.exerciseId}
                          selectedExercise={
                            exercise.exerciseId
                              ? {
                                  id: exercise.exerciseId,
                                  name: exercise.exerciseName,
                                  muscleGroup: exercise.muscleGroup,
                                }
                              : undefined
                          }
                          searchExercises={(query) => api.getExercises(query, 20)}
                          onSelect={(selectedExercise) =>
                            updateExercise(day.id, exercise.id, (currentExercise) => ({
                              ...currentExercise,
                              exerciseId: selectedExercise.id,
                              exerciseName: selectedExercise.name,
                              muscleGroup: selectedExercise.muscleGroup,
                            }))
                          }
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`sets-${exercise.id}`}>Series</Label>
                          <Input
                            id={`sets-${exercise.id}`}
                            type="number"
                            min="1"
                            value={exercise.targetSets}
                            onChange={(event) =>
                              updateExercise(day.id, exercise.id, (currentExercise) => ({
                                ...currentExercise,
                                targetSets: event.target.value,
                              }))
                            }
                            className={planInputClassName}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`reps-${exercise.id}`}>Reps</Label>
                          <Input
                            id={`reps-${exercise.id}`}
                            type="text"
                            value={exercise.targetReps}
                            onChange={(event) =>
                              updateExercise(day.id, exercise.id, (currentExercise) => ({
                                ...currentExercise,
                                targetReps: event.target.value,
                              }))
                            }
                            placeholder="8 a 12"
                            className={planInputClassName}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`rest-${exercise.id}`}>Descanso</Label>
                          <Input
                            id={`rest-${exercise.id}`}
                            type="number"
                            min="0"
                            value={exercise.restSeconds}
                            onChange={(event) =>
                              updateExercise(day.id, exercise.id, (currentExercise) => ({
                                ...currentExercise,
                                restSeconds: event.target.value,
                              }))
                            }
                            className={planInputClassName}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`notes-${exercise.id}`}>Notas opcionales</Label>
                        <Textarea
                          id={`notes-${exercise.id}`}
                          value={exercise.notes}
                          onChange={(event) =>
                            updateExercise(day.id, exercise.id, (currentExercise) => ({
                              ...currentExercise,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Ej: mantener tecnica controlada o usar pausa al final."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => addExercise(day.id)}
              >
                <Plus className="w-4 h-4" />
                Agregar ejercicio
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" variant="outline" className="gap-2" onClick={addDay}>
        <Plus className="w-4 h-4" />
        Agregar dia
      </Button>

      <Button type="button" size="lg" onClick={handleSubmit} disabled={!canSave}>
        {saving ? submittingLabel : submitLabel}
      </Button>
    </div>
  )
}
