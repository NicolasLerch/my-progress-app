import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import prismaPackage from '@prisma/client'
import { PrismaRepository } from '../src/repositories/prisma-repository.js'
import { FileImportService } from '../src/services/routine-import/service.js'

// Explicit opt-in only: never use the development or production DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL
test('PostgreSQL: preview does not persist; invalid confirmation preserves active plan; success creates all relations', { skip: !databaseUrl }, async () => {
  const client = new prismaPackage.PrismaClient({ datasources: { db: { url: databaseUrl } } })
  const repository = new PrismaRepository(client)
  const userId = `import-test-${randomUUID()}`
  const exerciseId = `import-exercise-${randomUUID()}`
  const input = { name: 'Plan importado', startDate: new Date().toISOString(), status: 'active' as const, days: [{ name: 'Pecho', order: 1, exercises: [{ order: 1, exerciseId, exerciseName: 'Press banca', targetSets: 4, targetReps: '8-12', restSeconds: 90 }] }] }
  try {
    await client.exercise.create({ data: { id: exerciseId, name: 'Press banca', muscleGroup: 'Pecho' } })
    const previous = await repository.createPlan(userId, input)
    const service = new FileImportService(() => client.exercise.findMany(), { interpretRoutine: async () => ({ name: 'Rutina', days: [{ name: 'Día 1', exercises: [{ originalName: 'Press banca', sets: 4, reps: { min: 8, max: 12, text: '8-12' }, restSeconds: 90, weight: null, weightUnit: null, notes: null, supersetGroupId: null }] }] }) }, async () => ({ blocks: [{ kind: 'text', source: '1', text: 'Press banca' }] }))
    await service.importFile(Buffer.from('%PDF-test'), 'routine.pdf', 'application/pdf')
    assert.equal(await client.plan.count({ where: { userId } }), 1)
    const invalid = structuredClone(input)
    invalid.days[0].exercises.push({ ...invalid.days[0].exercises[0], order: 2, exerciseId: `missing-${randomUUID()}` })
    await assert.rejects(repository.createPlan(userId, invalid), { code: 'INVALID_EXERCISE' })
    assert.equal(await client.plan.count({ where: { userId } }), 1)
    assert.equal((await client.plan.findUniqueOrThrow({ where: { id: previous.id } })).status, 'active')
    assert.equal(await client.planDay.count({ where: { plan: { userId } } }), 1)
    assert.equal(await client.planExercise.count({ where: { planDay: { plan: { userId } } } }), 1)
    const created = await repository.createPlan(userId, input)
    assert.equal(created.days[0].exercises[0].targetReps, '8-12')
    assert.equal((await client.plan.findUniqueOrThrow({ where: { id: previous.id } })).status, 'archived')
  } finally {
    await client.user.deleteMany({ where: { id: userId } })
    await client.exercise.deleteMany({ where: { id: exerciseId } })
    await client.$disconnect()
  }
})
