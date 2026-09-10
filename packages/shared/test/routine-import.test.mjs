import assert from 'node:assert/strict'
import test from 'node:test'
import { importedExerciseNotes, importedExerciseReps, importedRoutineSchema } from '../dist/routine-import.js'

const exercise = { originalName: 'Press', sets: null, reps: null, weight: null, weightUnit: null, restSeconds: null, notes: null, supersetGroupId: null }
test('missing fields stay null and are not replaced by defaults', () => {
  const parsed = importedRoutineSchema.parse({ name: null, days: [{ name: null, exercises: [exercise] }] })
  assert.deepEqual(parsed.days[0].exercises[0], exercise)
  assert.equal(importedExerciseReps(exercise), '')
  assert.equal(importedExerciseNotes(exercise), '')
})
test('weights and units are preserved in editable notes without mutating source', () => {
  const weighted = { ...exercise, weight: 20, weightUnit: 'lb', notes: 'Pausa' }
  assert.equal(importedExerciseNotes(weighted), 'Pausa\nPeso indicado: 20 lb.')
  assert.equal(importedExerciseNotes(weighted), 'Pausa\nPeso indicado: 20 lb.')
  assert.equal(weighted.notes, 'Pausa')
  assert.match(importedExerciseNotes({ ...exercise, weight: 0 }), /unidad no indicada/)
})
test('repetition ranges and expressions remain intact', () => {
  assert.equal(importedExerciseReps({ ...exercise, reps: { min: 8, max: 12, text: null } }), '8-12')
  assert.equal(importedExerciseReps({ ...exercise, reps: { min: 10, max: 10, text: null } }), '10')
  assert.equal(importedExerciseReps({ ...exercise, reps: { min: null, max: null, text: '10/8/6' } }), '10/8/6')
})
