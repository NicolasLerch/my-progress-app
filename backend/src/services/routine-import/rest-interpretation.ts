import { z } from 'zod'
import { importedExerciseSchema, importedRoutineSchema, type ImportedRoutine } from '@my-progress/shared'

// Ask the model to copy the prescription; perform all duration arithmetic in code.
export const interpretedRoutineSchema = importedRoutineSchema.extend({
  days: z.array(z.object({
    name: z.string().max(300).nullable(),
    exercises: z.array(importedExerciseSchema.omit({ restSeconds: true }).extend({
      restText: z.string().max(500).nullable(),
    })).max(100),
  })).max(30),
})

export function parseRestPrescription(text: string | null): { seconds: number | null; note: string | null } {
  if (text === null || !text.trim()) return { seconds: null, note: null }
  const original = text.trim()
  const normalized = original.toLowerCase().replace(/,/g, '.').replace(/[–—−]/g, '-')
    .replace(/^(?:descanso|pausa|rest)\s*:?\s*/u, '')
  const amount = '(\\d+(?:\\.\\d+)?)'
  const unit = '(minutos?|mins?\\.?|minutes?|segundos?|segs?\\.?|seconds?|secs?\\.?|s|m|[\'′’]|["″”])'
  const match = normalized.match(new RegExp(`^${amount}\\s*${unit}?\\s*(?:(?:-|a|hasta|to)\\s*${amount}\\s*${unit}?)?$`, 'u'))
  const preserve = { seconds: null, note: `Descanso indicado: ${original}. Completar en segundos.` }
  if (!match) return preserve
  const [, first, firstUnit, second, secondUnit] = match
  const scale = (value: string) => /^(?:m|min|minute)|['′’]/u.test(value) ? 60 : 1
  const effectiveFirstUnit = firstUnit ?? secondUnit
  if (!effectiveFirstUnit) return preserve
  const lower = Number(first) * scale(effectiveFirstUnit)
  const upper = second === undefined ? lower : Number(second) * scale(secondUnit ?? effectiveFirstUnit)
  if (lower > upper || !Number.isFinite(upper) || upper > 2147483647) return preserve
  const seconds = Math.ceil(upper)
  return {
    seconds,
    note: second === undefined ? null : `Descanso indicado: ${original}. Se usa el máximo del rango: ${seconds} s.`,
  }
}

export function normalizeInterpretedRoutine(output: unknown): ImportedRoutine {
  const parsed = interpretedRoutineSchema.parse(output)
  return importedRoutineSchema.parse({
    ...parsed,
    days: parsed.days.map(day => ({ ...day, exercises: day.exercises.map(({ restText, ...exercise }) => {
      const rest = parseRestPrescription(restText)
      return { ...exercise, restSeconds: rest.seconds, notes: [exercise.notes, rest.note].filter(Boolean).join('\n') || null }
    }) })),
  })
}
