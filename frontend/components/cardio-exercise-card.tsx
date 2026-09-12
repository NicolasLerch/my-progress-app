"use client"

import { useState } from "react"
import type { WorkoutExerciseDTO } from "@my-progress/shared"
import { cardioResultInputSchema } from "@my-progress/shared"
import type { TrainingDraftExerciseState } from "@/lib/offline-workouts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

export function CardioExerciseCard({ exercise, state, onChange, onSave, onReplace }: {
  exercise: WorkoutExerciseDTO
  state: TrainingDraftExerciseState
  onChange: (patch: Partial<TrainingDraftExerciseState>) => void
  onSave: () => Promise<void>
  onReplace?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const parsed = cardioResultInputSchema.safeParse({
    durationMinutes: state.durationMinutes?.trim() ? Number(state.durationMinutes) : undefined,
    distanceMeters: state.distanceMeters?.trim() ? Number(state.distanceMeters) : null,
    inclinePercent: state.inclinePercent?.trim() ? Number(state.inclinePercent) : null,
  })
  return <Card className={exercise.cardioResult ? "border-primary/30 bg-primary/5" : ""}>
    <CardContent className="p-0">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => onChange({ expanded: !state.expanded })} aria-expanded={state.expanded}>
        {exercise.cardioResult && <Check className="size-5 text-primary" />}
        <div className="flex-1">
          <p className="font-medium">{exercise.exerciseName}</p>
          <p className="text-xs text-muted-foreground">Cardio{exercise.targetDurationMinutes != null ? ` · Objetivo: ${exercise.targetDurationMinutes} min` : ""}</p>
          {(exercise.targetDistanceMeters != null || exercise.targetInclinePercent != null) && <p className="text-xs text-muted-foreground">
            {exercise.targetDistanceMeters != null ? `Distancia objetivo: ${exercise.targetDistanceMeters} m` : ""}
            {exercise.targetDistanceMeters != null && exercise.targetInclinePercent != null ? " · " : ""}
            {exercise.targetInclinePercent != null ? `Inclinación objetivo: ${exercise.targetInclinePercent}%` : ""}
          </p>}
          {exercise.cardioResult && <p className="text-sm text-primary">{exercise.cardioResult.durationMinutes} min registrados</p>}
        </div>
        {state.expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
      </button>
      {state.expanded && <div className="flex flex-col gap-3 border-t p-4">
        {exercise.notes && <p className="text-sm text-muted-foreground">{exercise.notes}</p>}
        {onReplace && <Button variant="outline" size="sm" onClick={onReplace}>Cambiar ejercicio</Button>}
        <Label htmlFor={`cardio-duration-${exercise.id}`}>Duración realizada (minutos)</Label>
        <Input id={`cardio-duration-${exercise.id}`} type="number" inputMode="numeric" min="1" max="2147483647" step="1" required
          className="h-12 text-lg" value={state.durationMinutes ?? ""} onChange={event => onChange({ durationMinutes: event.target.value })} />
        <fieldset className="min-w-0">
          <legend className="text-sm text-muted-foreground">Métricas realizadas opcionales</legend>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`cardio-distance-${exercise.id}`}>Distancia (metros, opcional)</Label>
              <Input id={`cardio-distance-${exercise.id}`} type="number" inputMode="numeric" min="0" max="2147483647" step="1"
                placeholder="Sin registrar" value={state.distanceMeters ?? ""} onChange={event => onChange({ distanceMeters: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor={`cardio-incline-${exercise.id}`}>Inclinación (%, opcional)</Label>
              <Input id={`cardio-incline-${exercise.id}`} type="number" inputMode="decimal" min="0" step="any"
                placeholder="Sin registrar" value={state.inclinePercent ?? ""} onChange={event => onChange({ inclinePercent: event.target.value })} /></div>
          </div>
        </fieldset>
        {!parsed.success && state.durationMinutes && <p role="alert" className="text-sm text-destructive">Revisá los valores: minutos enteros mayores a cero, distancia entera e inclinación no negativas.</p>}
        <Button disabled={!parsed.success || saving} onClick={async () => { setSaving(true); try { await onSave() } finally { setSaving(false) } }}>
          {saving ? "Guardando..." : exercise.cardioResult ? "Actualizar cardio" : "Guardar cardio"}
        </Button>
      </div>}
    </CardContent>
  </Card>
}
