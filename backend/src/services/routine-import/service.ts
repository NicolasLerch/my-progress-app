import { randomUUID } from 'node:crypto'
import { importedRoutineSchema, routineImportResultSchema, type ExerciseDTO, type ImportedRoutine, type RoutineImportResult } from '@my-progress/shared'
import { validateUpload } from './upload-validation.js'
import { extractInWorker } from './extraction-worker.js'
import { OpenAIRoutineInterpreter, type RoutineInterpreter } from './interpreter.js'
import { CatalogExerciseMatcher } from './matcher.js'

export function matchRoutine(routine: ImportedRoutine, catalog: ExerciseDTO[]): RoutineImportResult {
  const matcher = new CatalogExerciseMatcher(catalog)
  const warnings: string[] = []
  const days = routine.days.map(day => {
    const exercises = day.exercises.map(exercise => ({ ...exercise, id: randomUUID(), match: matcher.match(exercise.originalName) }))
    const groups = new Set(exercises.map(exercise => exercise.supersetGroupId).filter((id): id is string => id !== null))
    for (const id of groups) {
      const members = exercises.flatMap((exercise, index) => exercise.supersetGroupId === id ? [{ exercise, index }] : [])
      const [first, second] = members
      if (members.length === 2 && first && second && second.index === first.index + 1 && first.exercise.sets !== null && first.exercise.restSeconds !== null && first.exercise.sets === second.exercise.sets && first.exercise.restSeconds === second.exercise.restSeconds) continue
      warnings.push(`La agrupación ${id} de ${day.name ?? 'un día'} quedó como ejercicios separados; revisá sus notas.`)
      for (const { exercise } of members) {
        exercise.supersetGroupId = null
        exercise.notes = [exercise.notes, `Agrupación indicada en el archivo: ${id}. Revisar series y descanso.`].filter(Boolean).join('\n')
      }
    }
    return { id: randomUUID(), name: day.name, exercises }
  })
  return routineImportResultSchema.parse({ routine: { name: routine.name, days }, warnings })
}
export class FileImportService {
  constructor(private readonly catalog: () => Promise<ExerciseDTO[]>, private readonly interpreter: RoutineInterpreter = new OpenAIRoutineInterpreter(), private readonly extract = extractInWorker) {}
  async importFile(data: Buffer, filename: string, mime: string): Promise<RoutineImportResult> {
    const format = validateUpload(data, filename, mime)
    const content = await this.extract(data, format)
    const routine = importedRoutineSchema.parse(await this.interpreter.interpretRoutine(content))
    return matchRoutine(routine, await this.catalog())
  }
}
