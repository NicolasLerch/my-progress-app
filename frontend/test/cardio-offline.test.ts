import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import type { WorkoutSessionDTO } from '@my-progress/shared'
import { applyPendingWorkoutOperations, queueCardioOperation, queueSetOperation, listSetOperations, removeSetOperation, saveSessionSnapshot, getSessionSnapshot, getCurrentSessionSnapshot, saveTrainingDraft, getTrainingDraft, clearSessionSetOperations } from '../lib/offline-workouts'
import { createWorkoutQueueSync } from '../lib/workout-sync'

const session = (id: string): WorkoutSessionDTO => ({
  id, userId: 'user', status: 'in_progress', date: '2026-09-12T12:00:00Z', startedAt: '2026-09-12T12:00:00Z', planName: 'Mixto', dayName: 'Día 1',
  exercises: [{ id: 'cardio', workoutSessionId: id, position: 1, exerciseId: 'treadmill', exerciseName: 'Cinta', type: 'CARDIO', isReplacement: false,
    targetDurationMinutes: 20, targetSets: null, targetReps: null, restSeconds: null, sets: [] }],
})

test('IndexedDB preserves cardio drafts, snapshots and pending edits across reloads', async () => {
  const original = session('restore')
  await saveSessionSnapshot(original)
  const draft = { id: original.id, exercises: { cardio: { expanded: true, weight: '', reps: '', durationMinutes: '15', distanceMeters: '', inclinePercent: '0' } } }
  await saveTrainingDraft(draft)
  await queueCardioOperation(original.id, 'cardio', { durationMinutes: 15, inclinePercent: 0 })
  assert.deepEqual(await getTrainingDraft(original.id), draft)
  const restored = applyPendingWorkoutOperations((await getSessionSnapshot(original.id))!, await listSetOperations(original.id))
  assert.equal(restored.exercises[0].targetDurationMinutes, 20)
  assert.equal(restored.exercises[0].cardioResult?.durationMinutes, 15)
  assert.equal(restored.exercises[0].cardioResult?.inclinePercent, 0)
  assert.deepEqual(restored.exercises[0].sets, [])
  assert.equal((await getCurrentSessionSnapshot('user'))?.id, original.id)
  assert.equal(await getCurrentSessionSnapshot('other-user'), undefined)
  await clearSessionSetOperations(original.id)
})

test('an in-flight response cannot delete a newer edit; drains are serialized', async () => {
  await queueCardioOperation('race', 'cardio', { durationMinutes: 15, distanceMeters: 1000 })
  let release!: () => void
  let started!: () => void
  const barrier = new Promise<void>(resolve => { release = resolve })
  const entered = new Promise<void>(resolve => { started = resolve })
  const sent: number[] = []
  const flush = createWorkoutQueueSync({
    list: listSetOperations, remove: removeSetOperation, isOnline: () => true,
    send: async operation => {
      assert.equal(operation.kind, 'cardio')
      if (operation.kind !== 'cardio') return
      sent.push(operation.payload.durationMinutes)
      if (sent.length === 1) { started(); await barrier }
    },
  })
  const first = flush('race')
  await entered
  await queueCardioOperation('race', 'cardio', { durationMinutes: 17, distanceMeters: null })
  assert.equal(flush('race'), first)
  release()
  assert.equal(await first, true)
  assert.deepEqual(sent, [15, 17])
  assert.deepEqual(await listSetOperations('race'), [])
})

test('offline and server failures retain both cardio and strength until a successful retry', async () => {
  await queueCardioOperation('retry', 'cardio', { durationMinutes: 15 })
  await queueSetOperation('retry', 'strength', { setNumber: 1, weight: 50, reps: 10, updatedAt: new Date().toISOString() })
  let online = false
  let fail = true
  const flush = createWorkoutQueueSync({ list: listSetOperations, remove: removeSetOperation, isOnline: () => online,
    send: async () => { if (fail) throw new Error('offline') },
  })
  assert.equal(await flush('retry'), false)
  online = true
  assert.equal(await flush('retry'), false)
  assert.equal((await listSetOperations('retry')).length, 2)
  fail = false
  assert.equal(await flush('retry'), true)
  assert.equal((await listSetOperations('retry')).length, 0)
})
