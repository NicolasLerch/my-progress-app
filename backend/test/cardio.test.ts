import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import prismaPackage from '@prisma/client'
import Fastify from 'fastify'
import { demoUser, type CreatePlanInputDTO } from '@my-progress/shared'
import { PrismaRepository } from '../src/repositories/prisma-repository.js'
import { matchRoutine } from '../src/services/routine-import/service.js'

test('import review carries cardio type and ungroups cardio without converting reps to minutes', () => {
  const routine = matchRoutine({ name: 'Mixto', days: [{ name: 'Día 1', exercises: ['Cinta', 'Press banca'].map(originalName => ({ originalName, sets: 2, reps: { min: 15, max: 15, text: '15' }, restSeconds: 60, weight: null, weightUnit: null, notes: null, supersetGroupId: 'A' })) }] }, [
    { id: 'treadmill', name: 'Cinta', muscleGroup: 'Cardio', type: 'CARDIO' },
    { id: 'bench', name: 'Press banca', muscleGroup: 'Pecho', type: 'STRENGTH' },
  ])
  assert.equal(routine.routine.days[0].exercises[0].match.exercise?.type, 'CARDIO')
  assert.equal(routine.routine.days[0].exercises[0].supersetGroupId, null)
  assert.equal(routine.routine.days[0].exercises[1].supersetGroupId, null)
  assert.ok(routine.warnings.length)
})

const databaseUrl = process.env.TEST_DATABASE_URL
test('PostgreSQL and HTTP: mixed sessions, unique cardio, ownership, validation, history and strength regressions', { skip: !databaseUrl }, async () => {
  // Never fall back to the application's configured database.
  process.env.DATABASE_URL = databaseUrl
  process.env.SUPABASE_URL = 'http://127.0.0.1:1'
  process.env.ALLOW_DEMO_AUTH = 'true'
  const { registerRoutes } = await import('../src/routes.js')
  const { prisma: routeClient } = await import('../src/lib/prisma.js')
  const client = new prismaPackage.PrismaClient({ datasources: { db: { url: databaseUrl } } })
  const repository = new PrismaRepository(client)
  const app = Fastify()
  await registerRoutes(app)
  const userId = `cardio-test-${randomUUID()}`
  const previousDemoId = demoUser.id
  demoUser.id = userId
  const strengthId = `strength-${randomUUID()}`
  const cardioId = `cardio-${randomUUID()}`
  const otherCardioId = `cardio-${randomUUID()}`
  try {
    const strength = await client.exercise.create({ data: { id: strengthId, name: 'Press prueba', muscleGroup: 'Pecho' } })
    assert.equal(strength.type, 'STRENGTH')
    await client.exercise.createMany({ data: [cardioId, otherCardioId].map(id => ({ id, name: 'Cinta prueba', muscleGroup: 'Cardio', type: 'CARDIO' })) })
    const input: CreatePlanInputDTO = { name: 'Plan mixto', startDate: new Date().toISOString(), days: [{ name: 'Día 1', order: 1, exercises: [
      { order: 1, exerciseId: strengthId, exerciseName: 'Press prueba', targetSets: 4, targetReps: '8-12', restSeconds: 90 },
      { order: 2, exerciseId: cardioId, exerciseName: 'Cinta prueba', type: 'CARDIO', targetDurationMinutes: 20, targetDistanceMeters: 1000, targetInclinePercent: 2.5 },
    ] }] }
    const plan = await repository.createPlan(userId, input)
    const session = (await repository.createWorkoutSession(userId, { planId: plan.id, planDayId: plan.days[0].id, date: new Date().toISOString() }))!
    const [force, cardio] = session.exercises
    assert.equal(cardio.targetDurationMinutes, 20)
    assert.equal(cardio.targetDistanceMeters, 1000)
    assert.equal(cardio.targetInclinePercent, 2.5)
    assert.equal(cardio.targetSets, null)
    assert.equal(cardio.targetReps, null)
    assert.equal(cardio.restSeconds, null)
    const url = `/workout-sessions/${session.id}/exercises/${cardio.id}/cardio-result`
    const put = (payload: object, target = url) => app.inject({ method: 'PUT', url: target, payload })
    assert.equal((await put({})).statusCode, 400)
    assert.equal((await put({ durationMinutes: 0 })).statusCode, 400)
    const first = await put({ durationMinutes: 15 })
    assert.equal(first.statusCode, 200, first.body)
    assert.equal(first.json().exercises[1].cardioResult.durationMinutes, 15)
    assert.equal(first.json().exercises[1].cardioResult.distanceMeters, null)
    const resultId = first.json().exercises[1].cardioResult.id
    await put({ durationMinutes: 16, distanceMeters: 1000, inclinePercent: 2.5 })
    const cleared = await put({ durationMinutes: 17, distanceMeters: null, inclinePercent: null })
    assert.equal(cleared.json().exercises[1].cardioResult.id, resultId)
    assert.equal(cleared.json().exercises[1].cardioResult.distanceMeters, null)
    assert.equal(cleared.json().exercises[1].cardioResult.inclinePercent, null)
    assert.equal(await client.cardioResult.count({ where: { workoutExerciseId: cardio.id } }), 1)
    await assert.rejects(client.cardioResult.create({ data: { workoutExerciseId: cardio.id, durationMinutes: 10 } }), { code: 'P2002' })
    assert.equal((await put({ durationMinutes: 15 }, url.replace(cardio.id, force.id))).statusCode, 400)
    assert.equal((await put({ durationMinutes: 15 }, url.replace(session.id, 'missing'))).statusCode, 404)
    assert.equal(await repository.upsertCardioResult('other-user', session.id, cardio.id, { durationMinutes: 15 }), null)
    demoUser.id = 'other-user'
    assert.equal((await put({ durationMinutes: 15 })).statusCode, 404)
    demoUser.id = userId
    const seriesPayload = { setNumber: 1, weight: 50, reps: 10, updatedAt: new Date().toISOString() }
    assert.equal((await app.inject({ method: 'POST', url: url.replace('cardio-result', 'sets'), payload: seriesPayload })).statusCode, 400)
    await repository.upsertWorkoutSet(userId, session.id, force.id, seriesPayload)
    await assert.rejects(repository.replaceWorkoutExercise(userId, session.id, cardio.id, { exerciseId: otherCardioId }))
    const changed = structuredClone(plan)
    changed.days[0].exercises[1].targetDurationMinutes = 30
    changed.days[0].exercises[1].targetDistanceMeters = null
    changed.days[0].exercises[1].targetInclinePercent = null
    await repository.updatePlan(userId, plan.id, { days: changed.days })
    assert.equal((await repository.getWorkoutSession(userId, session.id))!.exercises[1].targetDurationMinutes, 20)
    assert.equal((await repository.getWorkoutSession(userId, session.id))!.exercises[1].targetDistanceMeters, 1000)
    assert.equal((await repository.getWorkoutSession(userId, session.id))!.exercises[1].targetInclinePercent, 2.5)
    const updatedPlan = (await repository.getPlan(userId, plan.id))!
    assert.equal(updatedPlan.days[0].exercises[1].targetDistanceMeters, null)
    assert.equal(updatedPlan.days[0].exercises[1].targetInclinePercent, null)
    changed.days[0].exercises[1].type = 'STRENGTH'
    assert.equal((await app.inject({ method: 'PUT', url: `/plans/${plan.id}`, payload: { days: changed.days } })).statusCode, 400)
    const forged = structuredClone(input)
    forged.days[0].exercises[1] = { ...forged.days[0].exercises[0], order: 2, exerciseId: cardioId }
    assert.equal((await app.inject({ method: 'POST', url: '/plans', payload: forged })).statusCode, 400)
    await repository.completeWorkoutSession(userId, session.id)
    assert.equal((await repository.getHistory(userId))[0].totalVolume, 500)
    assert.equal((await repository.getProgressSeries(userId, strengthId))!.stats.maxWeight, 50)
    assert.deepEqual((await repository.getProgressExercises(userId)).map(item => item.id), [strengthId])
    assert.equal((await app.inject({ method: 'GET', url: `/progress/exercises/${cardioId}` })).statusCode, 400)
    assert.equal((await repository.getHome({ id: userId, email: demoUser.email, name: 'Test' })).stats.totalWeightLifted, 500)
    const history = await app.inject({ method: 'GET', url: `/history/${session.id}` })
    assert.equal(history.json().exercises[1].cardioResult.durationMinutes, 17)
    const free = (await repository.createWorkoutSession(userId, { mode: 'planless', date: new Date().toISOString() }))!
    const added = (await repository.addWorkoutExercise(userId, free.id, cardioId))!
    assert.equal(added.exercises[0].targetDurationMinutes, null)
    await assert.rejects(repository.replaceWorkoutExercise(userId, free.id, added.exercises[0].id, { exerciseId: strengthId }))
    const replaced = (await repository.replaceWorkoutExercise(userId, free.id, added.exercises[0].id, { exerciseId: otherCardioId }))!
    assert.equal(replaced.exercises[0].exerciseId, otherCardioId)
    assert.equal(await repository.upsertCardioResult(userId, free.id, cardio.id, { durationMinutes: 5 }), null)
    await repository.upsertCardioResult(userId, free.id, added.exercises[0].id, { durationMinutes: 5, distanceMeters: 0, inclinePercent: 0 })
    await client.workoutSession.delete({ where: { id: free.id } })
    assert.equal(await client.cardioResult.count({ where: { workoutExerciseId: added.exercises[0].id } }), 0)
    const catalog = await repository.getExercises({ query: 'Cinta prueba' })
    assert.ok(catalog.every(exercise => exercise.type === 'CARDIO'))
    process.env.ALLOW_DEMO_AUTH = 'false'
    assert.equal((await put({ durationMinutes: 15 })).statusCode, 401)
  } finally {
    demoUser.id = previousDemoId
    await app.close()
    await client.user.deleteMany({ where: { id: userId } })
    await client.exercise.deleteMany({ where: { id: { in: [strengthId, cardioId, otherCardioId] } } })
    await client.$disconnect()
    await routeClient.$disconnect()
  }
})
