import test from "node:test"
import { randomUUID } from "node:crypto"
import prismaPackage from "@prisma/client"
import type { CreatePlanInputDTO } from "@my-progress/shared"
import { PrismaRepository } from "../src/repositories/prisma-repository.js"

const databaseUrl = process.env.TEST_DATABASE_URL

test("home advances the active plan and reports Buenos Aires completions", { skip: !databaseUrl }, async () => {
  process.env.DATABASE_URL = databaseUrl

  const client = new prismaPackage.PrismaClient({ datasources: { db: { url: databaseUrl } } })
  const repository = new PrismaRepository(client)
  const userId = `home-progression-${randomUUID()}`
  const exerciseId = `home-progression-exercise-${randomUUID()}`
  const user = { id: userId, email: `${userId}@example.com`, name: "Home test" }

  try {
    await client.exercise.create({ data: { id: exerciseId, name: "Press progression", muscleGroup: "Pecho" } })
    const input: CreatePlanInputDTO = {
      name: "Plan progression",
      startDate: new Date().toISOString(),
      status: "active",
      days: Array.from({ length: 4 }, (_, index) => ({
        name: `Dia ${index + 1}`,
        order: index + 1,
        exercises: [{ order: 1, exerciseId, exerciseName: "Press progression", targetSets: 3, targetReps: "8", restSeconds: 60 }],
      })),
    }
    const plan = await repository.createPlan(userId, input)
    const day = (order: number) => plan.days.find((item) => item.order === order)!
    const startAndComplete = async (order: number) => {
      const session = (await repository.createWorkoutSession(userId, {
        planId: plan.id,
        planDayId: day(order).id,
        date: new Date().toISOString(),
      }))!
      return repository.completeWorkoutSession(userId, session.id)
    }

    let home = await repository.getHome(user)
    assert.equal(home.todayDay?.id, day(1).id)
    assert.deepEqual(home.completedPlanDayIdsToday, [])

    const dayOneSession = (await startAndComplete(1))!
    await repository.completeWorkoutSession(userId, dayOneSession.id)
    home = await repository.getHome(user)
    assert.equal((await repository.getPlan(userId, plan.id))?.currentDay, 2)
    assert.equal(home.todayDay?.id, day(1).id)
    assert.deepEqual(home.completedPlanDayIdsToday, [day(1).id])

    const dayTwoSession = (await startAndComplete(2))!
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000)
    await client.workoutSession.updateMany({
      where: { id: { in: [dayOneSession.id, dayTwoSession.id] } },
      data: { completedAt: yesterday },
    })
    home = await repository.getHome(user)
    assert.equal((await repository.getPlan(userId, plan.id))?.currentDay, 3)
    assert.equal(home.todayDay?.id, day(3).id)
    assert.deepEqual(home.completedPlanDayIdsToday, [])

    const dayThreeSession = (await startAndComplete(3))!
    await client.workoutSession.update({ where: { id: dayThreeSession.id }, data: { completedAt: yesterday } })
    assert.equal((await repository.getPlan(userId, plan.id))?.currentDay, 4)

    const dayFourSession = (await startAndComplete(4))!
    await client.workoutSession.update({ where: { id: dayFourSession.id }, data: { completedAt: yesterday } })
    home = await repository.getHome(user)
    assert.equal((await repository.getPlan(userId, plan.id))?.currentDay, 1)
    assert.equal(home.todayDay?.id, day(1).id)

    const completedDayOne = (await startAndComplete(1))!
    const completedDayTwo = (await startAndComplete(2))!
    home = await repository.getHome(user)
    assert.equal((await repository.getPlan(userId, plan.id))?.currentDay, 3)
    assert.deepEqual(new Set(home.completedPlanDayIdsToday), new Set([day(1).id, day(2).id]))
    assert.equal(home.todayDay?.id, day(2).id)

    const currentDayBeforeFreeWorkout = (await repository.getPlan(userId, plan.id))?.currentDay
    const freeSession = (await repository.createWorkoutSession(userId, { mode: "planless", date: new Date().toISOString() }))!
    await repository.completeWorkoutSession(userId, freeSession.id)
    assert.equal((await repository.getPlan(userId, plan.id))?.currentDay, currentDayBeforeFreeWorkout)
    assert.ok(completedDayOne.id)
    assert.ok(completedDayTwo.id)
  } finally {
    await client.user.deleteMany({ where: { id: userId } })
    await client.exercise.deleteMany({ where: { id: exerciseId } })
    await client.$disconnect()
  }
})
