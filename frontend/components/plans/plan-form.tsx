'use client'

import Link from 'next/link'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Link2, Plus, Trash2, Unlink } from 'lucide-react'
import type { CreatePlanInputDTO, ExerciseDTO, PlanDTO } from '@my-progress/shared'
import { createPlanInputSchema, importedExerciseNotes, importedExerciseReps, type RoutineImportResult } from '@my-progress/shared'
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
  supersetGroupId?: string
  notes: string
  imported?: RoutineImportResult['routine']['days'][number]['exercises'][number]
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
  importedRoutine?: RoutineImportResult
  onSubmit: (values: PlanFormValues) => Promise<void>
}

type UpdateExercise = (
  dayId: string,
  exerciseId: string,
  updater: (exercise: ExerciseForm) => ExerciseForm,
) => void

function ImportReview({ exercise }: { exercise: ExerciseForm }) {
  const source = exercise.imported
  if (!source) return null
  const labels = { high: 'Coincidencia exacta', medium: 'Sugerencia aproximada: revisá el ejercicio seleccionado', low: 'Sugerencia dudosa: revisá el ejercicio seleccionado', unresolved: 'Sin coincidencia: seleccioná un ejercicio' }
  const changed = Boolean(exercise.exerciseId) && exercise.exerciseId !== source.match.exercise?.id
  return <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-2">
    <p><span className="font-medium">En el archivo:</span> {source.originalName}</p>
    <p>{changed ? 'Ejercicio seleccionado manualmente' : labels[source.match.status]}</p>
    {source.weight !== null ? <p>Peso indicado: {source.weight} {source.weightUnit ?? '(unidad no indicada)'} · Conservado en notas.</p> : null}
  </div>
}

function mapImportToForm(result: RoutineImportResult): PlanFormValues {
  return {
    name: result.routine.name?.trim() || 'Rutina importada',
    days: result.routine.days.map((day, index) => ({
      id: day.id, name: day.name?.trim() || `Día ${index + 1}`,
      exercises: day.exercises.map(source => {
        const selected = source.match.status !== 'unresolved' ? source.match.exercise : null
        return { id: source.id, exerciseId: selected?.id ?? '', exerciseName: selected?.name ?? '', muscleGroup: selected?.muscleGroup ?? '', targetSets: source.sets === null ? '' : String(source.sets), targetReps: importedExerciseReps(source), restSeconds: source.restSeconds === null ? '' : String(source.restSeconds), notes: importedExerciseNotes(source), supersetGroupId: source.supersetGroupId ?? undefined, imported: source }
      }),
    })),
  }
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
    supersetGroupId: undefined,
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

function PlanExerciseFields({
  dayId,
  exercise,
  sharedValues,
  planInputClassName,
  updateExercise,
}: {
  dayId: string
  exercise: ExerciseForm
  sharedValues: boolean
  planInputClassName: string
  updateExercise: UpdateExercise
}) {
  return (
    <div className="flex flex-col gap-3">
      <ImportReview exercise={exercise} />
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
            updateExercise(dayId, exercise.id, (currentExercise) => ({
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
          <Label htmlFor={`sets-${exercise.id}`}>{sharedValues ? 'Series compartidas' : 'Series'}</Label>
          <Input
            id={`sets-${exercise.id}`}
            type="number"
            min="1"
            value={exercise.targetSets}
            onChange={(event) =>
              updateExercise(dayId, exercise.id, (currentExercise) => ({
                ...currentExercise,
                targetSets: event.target.value,
              }))
            }
            className={planInputClassName}
            disabled={sharedValues}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`reps-${exercise.id}`}>Reps</Label>
          <Input
            id={`reps-${exercise.id}`}
            type="text"
            value={exercise.targetReps}
            onChange={(event) =>
              updateExercise(dayId, exercise.id, (currentExercise) => ({
                ...currentExercise,
                targetReps: event.target.value,
              }))
            }
            placeholder="8 a 12"
            className={planInputClassName}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`rest-${exercise.id}`}>{sharedValues ? 'Descanso compartido' : 'Descanso'}</Label>
          <Input
            id={`rest-${exercise.id}`}
            type="number"
            min="0"
            value={exercise.restSeconds}
            onChange={(event) =>
              updateExercise(dayId, exercise.id, (currentExercise) => ({
                ...currentExercise,
                restSeconds: event.target.value,
              }))
            }
            className={planInputClassName}
            disabled={sharedValues}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`notes-${exercise.id}`}>Notas opcionales</Label>
        <Textarea
          id={`notes-${exercise.id}`}
          value={exercise.notes}
          onChange={(event) =>
            updateExercise(dayId, exercise.id, (currentExercise) => ({
              ...currentExercise,
              notes: event.target.value,
            }))
          }
          placeholder="Ej: mantener tecnica controlada o usar pausa al final."
        />
      </div>
    </div>
  )
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
        supersetGroupId: exercise.supersetGroupId,
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
  if (!value.trim()) return null
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
        supersetGroupId: exercise.supersetGroupId,
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
  importedRoutine,
  onSubmit,
}: PlanFormProps) {
  const planNameId = useId()
  const submitting = useRef(false)
  const planInputClassName =
    'border-border/70 bg-secondary/75 text-foreground placeholder:text-muted-foreground shadow-none'

  const [name, setName] = useState(importedRoutine ? mapImportToForm(importedRoutine).name : initialPlan?.name ?? 'Nuevo plan')
  const [days, setDays] = useState<DayForm[]>(importedRoutine ? mapImportToForm(importedRoutine).days : initialPlan ? mapPlanToForm(initialPlan).days : [createDayForm(0)])
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

    const parsed = createPlanInputSchema.safeParse(buildPlanInput({ name, days }))
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path.includes('notes')) errors.push('Las notas deben tener como máximo 300 caracteres. Editalas sin perder los datos que querés conservar.')
        else if (issue.path.includes('supersetGroupId')) errors.push('Las superseries deben tener dos ejercicios consecutivos con las mismas series y descanso.')
        else if (issue.code === 'too_big') errors.push('Revisá la longitud de los nombres y repeticiones: máximo 100 y 30 caracteres respectivamente.')
      }
    }
    return [...new Set(errors)]
  }, [days, name])

  const canSave = !saving && validationErrors.length === 0

  function updateDay(dayId: string, updater: (day: DayForm) => DayForm) {
    setDays((currentDays) => currentDays.map((day) => (day.id === dayId ? updater(day) : day)))
  }

  function addDay() {
    setDays((currentDays) => [...currentDays, createDayForm(currentDays.length)])
  }

  function removeDay(dayId: string) {
    setDays((currentDays) => (currentDays.length === 1 && !importedRoutine ? currentDays : currentDays.filter((day) => day.id !== dayId)))
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
        day.exercises.length === 1 && !importedRoutine
          ? day.exercises
          : (() => {
              const removedExercise = day.exercises.find((exercise) => exercise.id === exerciseId)
              return day.exercises
                .filter((exercise) => exercise.id !== exerciseId)
                .map((exercise) =>
                  removedExercise?.supersetGroupId && exercise.supersetGroupId === removedExercise.supersetGroupId
                    ? { ...exercise, supersetGroupId: undefined }
                    : exercise,
                )
            })(),
    }))
  }

  function moveExercise(dayId: string, exerciseId: string, direction: 'up' | 'down') {
    updateDay(dayId, (day) => {
      const index = day.exercises.findIndex((exercise) => exercise.id === exerciseId)
      if (index === -1) return day
      const exercises = [...day.exercises]
      const groupId = exercises[index].supersetGroupId
      const groupStart = groupId && exercises[index - 1]?.supersetGroupId === groupId ? index - 1 : index
      const groupLength = groupId ? 2 : 1
      const adjacentIndex = direction === 'up' ? groupStart - 1 : groupStart + groupLength
      if (adjacentIndex < 0 || adjacentIndex >= day.exercises.length) return day

      const adjacentGroupId = exercises[adjacentIndex].supersetGroupId
      const adjacentGroupStart =
        adjacentGroupId && exercises[adjacentIndex - 1]?.supersetGroupId === adjacentGroupId
          ? adjacentIndex - 1
          : adjacentIndex
      const adjacentGroupLength = adjacentGroupId ? 2 : 1

      const moved = exercises.splice(groupStart, groupLength)
      const insertionIndex =
        direction === 'up' ? adjacentGroupStart : groupStart + adjacentGroupLength
      exercises.splice(insertionIndex, 0, ...moved)
      return { ...day, exercises }
    })
  }

  function updateExercise(
    dayId: string,
    exerciseId: string,
    updater: (exercise: ExerciseForm) => ExerciseForm,
  ) {
    updateDay(dayId, (day) => {
      const currentExercise = day.exercises.find((exercise) => exercise.id === exerciseId)
      if (!currentExercise) return day

      const nextExercise = updater(currentExercise)
      const syncSupersetValues = Boolean(nextExercise.supersetGroupId) && (
        nextExercise.targetSets !== currentExercise.targetSets || nextExercise.restSeconds !== currentExercise.restSeconds
      )

      return {
        ...day,
        exercises: day.exercises.map((exercise) => {
          if (exercise.id === exerciseId) return nextExercise
          if (syncSupersetValues && exercise.supersetGroupId === nextExercise.supersetGroupId) {
            return {
              ...exercise,
              targetSets: nextExercise.targetSets,
              restSeconds: nextExercise.restSeconds,
            }
          }
          return exercise
        }),
      }
    })
  }

  function groupExerciseWithNext(dayId: string, exerciseId: string) {
    updateDay(dayId, (day) => {
      const index = day.exercises.findIndex((exercise) => exercise.id === exerciseId)
      const currentExercise = day.exercises[index]
      if (index === -1 || currentExercise.supersetGroupId) {
        return day
      }

      const supersetGroupId = createId('superset')
      return {
        ...day,
        exercises: [
          ...day.exercises.slice(0, index),
          { ...currentExercise, supersetGroupId },
          {
            ...createExerciseForm(),
            supersetGroupId,
            targetSets: currentExercise.targetSets,
            restSeconds: currentExercise.restSeconds,
          },
          ...day.exercises.slice(index + 1),
        ],
      }
    })
  }

  function ungroupExercise(dayId: string, supersetGroupId: string) {
    updateDay(dayId, (day) => ({
      ...day,
      exercises: day.exercises.map((exercise) =>
        exercise.supersetGroupId === supersetGroupId ? { ...exercise, supersetGroupId: undefined } : exercise,
      ),
    }))
  }

  async function handleSubmit() {
    if (!canSave || submitting.current) {
      return
    }

    submitting.current = true
    setSaving(true)

    try {
      await onSubmit({ name, days })
    } finally {
      submitting.current = false
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
            <Label htmlFor={planNameId}>Nombre del plan</Label>
            <Input
              id={planNameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej: Hipertrofia 4 dias"
              className={planInputClassName}
            />
          </div>
        </CardContent>
      </Card>

      {importedRoutine ? <div className="text-sm text-muted-foreground space-y-2">
        <p>Revisá los ejercicios y valores antes de crear la rutina.</p>
        {importedRoutine.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
      </div> : null}

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
                    disabled={days.length === 1 && !importedRoutine}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="sr-only">Eliminar dia</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {day.exercises.map((exercise, exerciseIndex) => {
                  const isSuperset = Boolean(exercise.supersetGroupId)
                  const isSupersetSecond =
                    isSuperset && day.exercises[exerciseIndex - 1]?.supersetGroupId === exercise.supersetGroupId
                  if (isSupersetSecond) {
                    return null
                  }

                  const supersetPartner =
                    isSuperset && day.exercises[exerciseIndex + 1]?.supersetGroupId === exercise.supersetGroupId
                      ? day.exercises[exerciseIndex + 1]
                      : undefined
                  const supersetStartIndex = isSupersetSecond ? exerciseIndex - 1 : exerciseIndex
                  const supersetGroupIndex = exercise.supersetGroupId
                    ? Array.from(
                        new Set(
                          day.exercises.flatMap((item) => item.supersetGroupId ? [item.supersetGroupId] : []),
                        ),
                      ).indexOf(exercise.supersetGroupId)
                    : -1
                  const supersetLabel = String.fromCharCode(65 + supersetGroupIndex)
                  const canGroupWithNext = !isSuperset

                  return (
                  <div
                    key={exercise.id}
                    className={`rounded-2xl border p-3 ${
                      isSuperset ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-medium">
                          {isSuperset ? `Superserie ${supersetLabel} · A1` : `Ejercicio ${exerciseIndex + 1}`}
                        </p>
                        {isSuperset ? <p className="text-xs text-primary">Descanso compartido al terminar A2</p> : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveExercise(day.id, exercise.id, 'up')}
                          disabled={supersetStartIndex === 0}
                        >
                          <ArrowUp className="w-4 h-4" />
                          <span className="sr-only">Subir ejercicio</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveExercise(day.id, exercise.id, 'down')}
                          disabled={supersetStartIndex + (isSuperset ? 2 : 1) === day.exercises.length}
                        >
                          <ArrowDown className="w-4 h-4" />
                          <span className="sr-only">Bajar ejercicio</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeExercise(day.id, exercise.id)}
                          disabled={day.exercises.length === 1 && !importedRoutine}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Eliminar ejercicio</span>
                        </Button>
                        {isSuperset ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-primary"
                            onClick={() => ungroupExercise(day.id, exercise.supersetGroupId!)}
                          >
                            <Unlink className="w-3.5 h-3.5" />
                            Desagrupar
                          </Button>
                        ) : canGroupWithNext ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-primary"
                            onClick={() => groupExerciseWithNext(day.id, exercise.id)}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            Superserie
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <ImportReview exercise={exercise} />
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
                          <Label htmlFor={`sets-${exercise.id}`}>{isSupersetSecond ? 'Series compartidas' : 'Series'}</Label>
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
                            disabled={isSupersetSecond}
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
                          <Label htmlFor={`rest-${exercise.id}`}>{isSupersetSecond ? 'Descanso compartido' : 'Descanso'}</Label>
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
                            disabled={isSupersetSecond}
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
                      {isSuperset && supersetPartner ? (
                        <div className="rounded-xl border border-primary/25 bg-background/50 p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-primary">{supersetLabel}2</p>
                              <p className="text-xs text-muted-foreground">Segundo ejercicio de la superserie</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeExercise(day.id, supersetPartner.id)}
                              disabled={day.exercises.length === 1 && !importedRoutine}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sr-only">Eliminar segundo ejercicio</span>
                            </Button>
                          </div>
                          <PlanExerciseFields
                            dayId={day.id}
                            exercise={supersetPartner}
                            sharedValues
                            planInputClassName={planInputClassName}
                            updateExercise={updateExercise}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  )
                })}
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

      {importedRoutine ? <p className="text-sm text-muted-foreground">Al crear la rutina aceptás los ejercicios seleccionados y sus valores. La rutina quedará activa desde hoy y el plan activo anterior se archivará.</p> : null}
      <Button type="button" size="lg" onClick={handleSubmit} disabled={!canSave}>
        {saving ? submittingLabel : submitLabel}
      </Button>
    </div>
  )
}
