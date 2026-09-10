import { z } from 'zod'

export const rawRoutineContentSchema = z.object({
  blocks: z.array(z.union([
    z.object({ kind: z.literal('table'), source: z.string(), rows: z.array(z.object({ row: z.number().int(), cells: z.array(z.object({ column: z.number().int(), text: z.string(), comment: z.string().nullable() })) })), merges: z.array(z.string()) }),
    z.object({ kind: z.literal('text'), source: z.string(), text: z.string() }),
  ])),
})
export const importedExerciseSchema = z.object({
  originalName: z.string().min(1).max(300).regex(/\S/),
  sets: z.number().int().positive().nullable(),
  reps: z.object({ min: z.number().int().nonnegative().nullable(), max: z.number().int().nonnegative().nullable(), text: z.string().max(1000).nullable() }).nullable(),
  weight: z.number().nonnegative().nullable(),
  weightUnit: z.enum(['kg', 'lb']).nullable(),
  restSeconds: z.number().int().nonnegative().nullable(),
  notes: z.string().max(5000).nullable(),
  supersetGroupId: z.string().max(100).nullable(),
})
export const importedRoutineDaySchema = z.object({ name: z.string().max(300).nullable(), exercises: z.array(importedExerciseSchema).max(100) })
export const importedRoutineSchema = z.object({ name: z.string().max(300).nullable(), days: z.array(importedRoutineDaySchema).max(30) })
export const exerciseMatchSchema = z.object({
  status: z.enum(['high', 'medium', 'low', 'unresolved']),
  score: z.number().min(0).max(1),
  exercise: z.object({ id: z.string(), name: z.string(), muscleGroup: z.string() }).nullable(),
})
export const routineImportResultSchema = z.object({
  routine: z.object({ name: z.string().nullable(), days: z.array(z.object({
    id: z.string(), name: z.string().nullable(), exercises: z.array(importedExerciseSchema.extend({ id: z.string(), match: exerciseMatchSchema, notes: z.string().max(6000).nullable() })),
  })) }),
  warnings: z.array(z.string()),
})
export type RawRoutineContent = z.infer<typeof rawRoutineContentSchema>
export type ImportedExercise = z.infer<typeof importedExerciseSchema>
export type ImportedRoutineDay = z.infer<typeof importedRoutineDaySchema>
export type ImportedRoutine = z.infer<typeof importedRoutineSchema>
export type ExerciseMatch = z.infer<typeof exerciseMatchSchema>
export type RoutineImportResult = z.infer<typeof routineImportResultSchema>

export function importedExerciseNotes(exercise: ImportedExercise): string {
  const weight = exercise.weight === null ? '' : `Peso indicado: ${exercise.weight}${exercise.weightUnit ? ` ${exercise.weightUnit}` : ' (unidad no indicada)'}.`
  return [exercise.notes, weight].filter(Boolean).join('\n')
}
export function importedExerciseReps(exercise: ImportedExercise): string {
  const reps = exercise.reps
  if (!reps) return ''
  if (reps.text?.trim()) return reps.text.trim()
  if (reps.min !== null && reps.max !== null) return reps.min === reps.max ? String(reps.min) : `${reps.min}-${reps.max}`
  return reps.min !== null ? `≥ ${reps.min}` : reps.max !== null ? `≤ ${reps.max}` : ''
}
