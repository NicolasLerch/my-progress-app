'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { CreatePlanInputDTO, ExerciseDTO, PlanDTO } from '@my-progress/shared'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type ExerciseForm = {
  id: string
  exerciseId: string
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
  onSubmit: (values: PlanFormValues, exercises: ExerciseDTO[]) => Promise<void>
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function createExerciseForm(defaultExerciseId = ''): ExerciseForm {
  return {
    id: createId('exercise'),
    exerciseId: defaultExerciseId,
    targetSets: '4',
    targetReps: '8',
    restSeconds: '90',
    notes: '',
  }
}

function createDayForm(index: number, defaultExerciseId = ''): DayForm {
  return {
    id: createId('day'),
    name: `Dia ${index + 1}`,
    exercises: [createExerciseForm(defaultExerciseId)],
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

export function buildPlanInput(
  values: PlanFormValues,
  exercises: ExerciseDTO[],
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
      exercises: day.exercises.map((exercise) => {
        const selectedExercise = exercises.find((item) => item.id === exercise.exerciseId)

        return {
          exerciseId: exercise.exerciseId,
          exerciseName: selectedExercise?.name ?? '',
          targetSets: parsePositiveInteger(exercise.targetSets) ?? 0,
          targetReps: parsePositiveInteger(exercise.targetReps) ?? 0,
          restSeconds: parseNonNegativeInteger(exercise.restSeconds) ?? 0,
          notes: exercise.notes.trim() || undefined,
        }
      }),
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
  const [exercises, setExercises] = useState<ExerciseDTO[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [name, setName] = useState(initialPlan?.name ?? 'Nuevo plan')
  const [days, setDays] = useState<DayForm[]>(initialPlan ? mapPlanToForm(initialPlan).days : [createDayForm(0)])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!initialPlan) {
      return
    }

    const nextForm = mapPlanToForm(initialPlan)
    setName(nextForm.name)
    setDays(nextForm.days)
  }, [initialPlan])

  useEffect(() => {
    api.getExercises()
      .then((items) => {
        if (items.length === 0) {
          const message = 'No hay ejercicios disponibles para crear un plan.'
          setCatalogError(message)
          toast({
            variant: 'destructive',
            title: 'Catalogo vacio',
            description: message,
          })
          return
        }

        setExercises(items)
        setDays((currentDays) =>
          currentDays.map((day) => ({
            ...day,
            exercises: day.exercises.map((exercise) =>
              exercise.exerciseId ? exercise : { ...exercise, exerciseId: items[0]?.id ?? '' },
            ),
          })),
        )
      })
      .catch((cause: Error) => {
        const message = cause.message || 'No se pudo cargar el catalogo de ejercicios.'
        setCatalogError(message)
        toast({
          variant: 'destructive',
          title: 'Error al cargar ejercicios',
          description: message,
        })
      })
  }, [])

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
        if (exercises.length > 0 && !exercise.exerciseId) {
          errors.push(`Falta seleccionar el ejercicio ${exerciseIndex + 1} del dia ${dayIndex + 1}.`)
        }

        if (parsePositiveInteger(exercise.targetSets) === null) {
          errors.push(`Las series del ejercicio ${exerciseIndex + 1} del dia ${dayIndex + 1} deben ser mayores a 0.`)
        }

        if (parsePositiveInteger(exercise.targetReps) === null) {
          errors.push(`Las repeticiones del ejercicio ${exerciseIndex + 1} del dia ${dayIndex + 1} deben ser mayores a 0.`)
        }

        if (parseNonNegativeInteger(exercise.restSeconds) === null) {
          errors.push(`El descanso del ejercicio ${exerciseIndex + 1} del dia ${dayIndex + 1} no puede ser negativo.`)
        }
      })
    })

    return errors
  }, [days, exercises.length, name])

  const canSave = !saving && !catalogError && exercises.length > 0 && validationErrors.length === 0

  function updateDay(dayId: string, updater: (day: DayForm) => DayForm) {
    setDays((currentDays) => currentDays.map((day) => (day.id === dayId ? updater(day) : day)))
  }

  function addDay() {
    setDays((currentDays) => [...currentDays, createDayForm(currentDays.length, exercises[0]?.id ?? '')])
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
      exercises: [...day.exercises, createExerciseForm(exercises[0]?.id ?? '')],
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
      await onSubmit({ name, days }, exercises)
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
            />
          </div>
        </CardContent>
      </Card>

      {catalogError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{catalogError}</p>
          </CardContent>
        </Card>
      ) : exercises.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cargando catalogo de ejercicios...</p>
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
                    className="mt-2"
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
                  <div key={exercise.id} className="rounded-2xl border border-border/60 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-sm font-medium">Ejercicio {exerciseIndex + 1}</p>
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

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`exercise-${exercise.id}`}>Ejercicio</Label>
                        <select
                          id={`exercise-${exercise.id}`}
                          value={exercise.exerciseId}
                          onChange={(event) =>
                            updateExercise(day.id, exercise.id, (currentExercise) => ({
                              ...currentExercise,
                              exerciseId: event.target.value,
                            }))
                          }
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Selecciona un ejercicio</option>
                          {exercises.map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
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
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`reps-${exercise.id}`}>Reps</Label>
                          <Input
                            id={`reps-${exercise.id}`}
                            type="number"
                            min="1"
                            value={exercise.targetReps}
                            onChange={(event) =>
                              updateExercise(day.id, exercise.id, (currentExercise) => ({
                                ...currentExercise,
                                targetReps: event.target.value,
                              }))
                            }
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
                disabled={exercises.length === 0}
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
