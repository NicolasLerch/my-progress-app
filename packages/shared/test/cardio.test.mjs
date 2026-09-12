import assert from 'node:assert/strict'
import test from 'node:test'
import { cardioResultInputSchema, createPlanInputSchema, buildProgressSeries, calculateSessionVolume } from '../dist/index.js'

test('cardio accepts duration alone, optional zeroes and explicit clearing', () => {
  for (const input of [{ durationMinutes: 15 }, { durationMinutes: 15, distanceMeters: 0, inclinePercent: 0 }, { durationMinutes: 15, distanceMeters: null, inclinePercent: null }]) {
    assert.deepEqual(cardioResultInputSchema.parse(input), input)
  }
})

test('cardio rejects invalid numbers, overflow and strength fields', () => {
  for (const input of [{}, { durationMinutes: null }, ...[0, -1, 1.5, 2147483648, Infinity, NaN, '15'].map(durationMinutes => ({ durationMinutes })),
    ...[-1, 0.5, 2147483648, Infinity].map(distanceMeters => ({ durationMinutes: 15, distanceMeters })),
    ...[-1, Infinity, NaN].map(inclinePercent => ({ durationMinutes: 15, inclinePercent })), { durationMinutes: 15, reps: 15 }]) {
    assert.equal(cardioResultInputSchema.safeParse(input).success, false, JSON.stringify(input))
  }
})

test('mixed plans require distinct targets, reject cardio supersets and accept legacy strength inputs', () => {
  const strength = { order: 1, exerciseId: 'bench', exerciseName: 'Press banca', targetSets: 4, targetReps: '8-12', restSeconds: 90 }
  const cardio = { order: 2, exerciseId: 'treadmill', exerciseName: 'Cinta', type: 'CARDIO', targetDurationMinutes: 20 }
  const plan = exercises => ({ name: 'Plan mixto', startDate: new Date().toISOString(), days: [{ name: 'Día 1', order: 1, exercises }] })
  assert.equal(createPlanInputSchema.safeParse(plan([strength, cardio])).success, true)
  for (const patch of [{ targetDistanceMeters: 1000 }, { targetInclinePercent: 2.5 }, { targetDistanceMeters: 0, targetInclinePercent: 0 }, { targetDistanceMeters: null, targetInclinePercent: null }]) {
    assert.equal(createPlanInputSchema.safeParse(plan([strength, { ...cardio, ...patch }])).success, true)
  }
  for (const patch of [{ targetDistanceMeters: -1 }, { targetDistanceMeters: 0.5 }, { targetDistanceMeters: 2147483648 }, { targetInclinePercent: -1 }, { targetInclinePercent: Infinity }]) {
    assert.equal(createPlanInputSchema.safeParse(plan([strength, { ...cardio, ...patch }])).success, false)
  }
  for (const patch of [{ targetDistanceMeters: 1000 }, { targetInclinePercent: 0 }]) {
    assert.equal(createPlanInputSchema.safeParse(plan([{ ...strength, ...patch }])).success, false)
  }
  for (const patch of [{ targetDurationMinutes: null }, { targetSets: 1 }, { targetReps: '20' }, { restSeconds: 0 }, { supersetGroupId: 'pair' }]) {
    assert.equal(createPlanInputSchema.safeParse(plan([strength, { ...cardio, ...patch }])).success, false)
  }
  assert.equal(createPlanInputSchema.safeParse(plan([{ ...strength, targetDurationMinutes: 20 }])).success, false)
})

test('cardio never contributes to force metrics, even with malformed legacy sets', () => {
  const strength = { exerciseId: 'bench', type: 'STRENGTH', sets: [{ weight: 50, reps: 10 }] }
  const cardio = { exerciseId: 'treadmill', type: 'CARDIO', sets: [{ weight: 999, reps: 999 }], cardioResult: { durationMinutes: 15 } }
  const session = { date: '2026-09-12T12:00:00Z', exercises: [strength, cardio] }
  assert.equal(calculateSessionVolume(session), 500)
  assert.equal(buildProgressSeries({ id: 'treadmill', type: 'CARDIO' }, [session]).points.length, 0)
  assert.equal(buildProgressSeries({ id: 'bench', type: 'STRENGTH' }, [session]).stats.maxWeight, 50)
})
