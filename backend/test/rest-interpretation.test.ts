import assert from 'node:assert/strict'
import test from 'node:test'
import { zodTextFormat } from 'openai/helpers/zod'
import { interpretedRoutineSchema, normalizeInterpretedRoutine, parseRestPrescription } from '../src/services/routine-import/rest-interpretation.js'

test('rest ranges use the upper bound and retain the original prescription', () => {
  for (const text of ['2-3 min', '2–3 min', '2—3 minutos', '2 a 3 min', '2 min - 3 min', "2-3'", 'Descanso: 2-3 min']) {
    const result = parseRestPrescription(text)
    assert.equal(result.seconds, 180, text)
    assert.ok(result.note?.includes(text))
  }
  assert.equal(parseRestPrescription('60-90 s').seconds, 90)
  assert.equal(parseRestPrescription('1,5-2 min').seconds, 120)
  assert.equal(parseRestPrescription('90 s - 2 min').seconds, 120)
})
test('single values, missing units and malformed ranges never become negative durations', () => {
  assert.deepEqual(parseRestPrescription('2 min'), { seconds: 120, note: null })
  assert.equal(parseRestPrescription('90 segundos').seconds, 90)
  assert.equal(parseRestPrescription('0 s').seconds, 0)
  assert.deepEqual(parseRestPrescription(null), { seconds: null, note: null })
  for (const text of ['-1 min', '3-2 min', '2-3', 'hasta recuperar', '2-3*60 min']) {
    const result = parseRestPrescription(text)
    assert.equal(result.seconds, null, text)
    assert.ok(result.note?.includes(text))
  }
})
test('the AI schema requests literal rest text; normalization produces the existing domain', () => {
  const format = zodTextFormat(interpretedRoutineSchema, 'imported_routine')
  assert.equal(format.strict, true)
  assert.ok(JSON.stringify(format.schema).includes('restText'))
  assert.ok(!JSON.stringify(format.schema).includes('restSeconds'))
  const result = normalizeInterpretedRoutine({ name: 'Rutina', days: [{ name: 'Pecho', exercises: [{
    originalName: 'Press banca', sets: 4, reps: { min: 8, max: 12, text: '8-12' }, weight: null, weightUnit: null,
    restText: '2-3 min', notes: 'Movimiento controlado', supersetGroupId: null,
  }] }] })
  const exercise = result.days[0].exercises[0]
  assert.equal(exercise.restSeconds, 180)
  assert.match(exercise.notes ?? '', /Movimiento controlado/)
  assert.match(exercise.notes ?? '', /2-3 min/)
  assert.equal(exercise.reps?.text, '8-12')
})
