import {
  demoUser,
  exercisesSeed,
  plansSeed,
  workoutSessionsSeed,
} from "@my-progress/shared"
import { PrismaClient, Prisma } from "@prisma/client"

const prisma = new PrismaClient()

function decimal(value: number) {
  return new Prisma.Decimal(value)
}

async function seed() {
  await prisma.workoutSet.deleteMany()
  await prisma.workoutExercise.deleteMany()
  await prisma.workoutSession.deleteMany()
  await prisma.planExercise.deleteMany()
  await prisma.planDay.deleteMany()
  await prisma.plan.deleteMany()
  await prisma.exercise.deleteMany()
  await prisma.user.deleteMany()

  await prisma.user.create({
    data: {
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name,
      lastName: demoUser.lastName,
      birthDate: demoUser.birthDate ? new Date(demoUser.birthDate) : null,
      weight: demoUser.weight ? decimal(demoUser.weight) : null,
      height: demoUser.height ? decimal(demoUser.height) : null,
      createdAt: new Date(demoUser.createdAt),
    },
  })

  await prisma.exercise.createMany({
    data: exercisesSeed,
  })

  for (const plan of plansSeed) {
    await prisma.plan.create({
      data: {
        id: plan.id,
        userId: plan.userId,
        name: plan.name,
        startDate: new Date(plan.startDate),
        endDate: plan.endDate ? new Date(plan.endDate) : null,
        status: plan.status,
        createdAt: new Date(plan.createdAt),
        updatedAt: new Date(plan.updatedAt),
        currentDay: plan.currentDay,
        totalDays: plan.totalDays,
        days: {
          create: plan.days.map((day) => ({
            id: day.id,
            name: day.name,
            order: day.order,
            exercises: {
              create: day.exercises.map((exercise) => ({
                id: exercise.id,
                exerciseId: exercise.exerciseId,
                targetSets: exercise.targetSets,
                targetReps: exercise.targetReps,
                restSeconds: exercise.restSeconds,
                notes: exercise.notes,
              })),
            },
          })),
        },
      },
    })
  }

  for (const session of workoutSessionsSeed) {
    await prisma.workoutSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        planId: session.planId,
        planDayId: session.planDayId,
        date: new Date(session.date),
        notes: session.notes,
        status: session.status,
        startedAt: new Date(session.startedAt),
        completedAt: session.completedAt ? new Date(session.completedAt) : null,
        durationMinutes: session.durationMinutes,
        planName: session.planName,
        dayName: session.dayName,
        exercises: {
          create: session.exercises.map((exercise) => ({
            id: exercise.id,
            position: exercise.position,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            planExerciseId: exercise.planExerciseId,
            replacesPlanExerciseId: exercise.replacesPlanExerciseId,
            replacementReason: exercise.replacementReason,
            isReplacement: exercise.isReplacement,
            targetSets: exercise.targetSets,
            targetReps: exercise.targetReps,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
            sets: {
              create: exercise.sets.map((set) => ({
                id: set.id,
                setNumber: set.setNumber,
                weight: decimal(set.weight),
                reps: set.reps,
                rir: set.rir,
                notes: set.notes,
                createdAt: new Date(set.createdAt),
                updatedAt: new Date(set.updatedAt),
              })),
            },
          })),
        },
      },
    })
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
