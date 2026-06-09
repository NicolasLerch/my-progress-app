import type { FastifyInstance } from "fastify"
import {
  createPlanInputSchema,
  createWorkoutExerciseInputSchema,
  createWorkoutSessionInputSchema,
  updatePlanDayInputSchema,
  updateUserProfileInputSchema,
  updateWorkoutSessionInputSchema,
  workoutSetInputSchema,
} from "@my-progress/shared"
import { prisma } from "./lib/prisma.js"
import { requireUser } from "./plugins/auth.js"
import { PrismaRepository } from "./repositories/prisma-repository.js"

export async function registerRoutes(app: FastifyInstance) {
  const repository = new PrismaRepository(prisma)

  app.addHook("preHandler", requireUser)

  app.get("/health", async () => ({ ok: true }))

  app.get("/exercises", async () => await repository.getExercises())

  app.get("/profile", async (request) => await repository.getProfile(request.user))

  app.put("/profile", async (request, reply) => {
    const input = updateUserProfileInputSchema.parse(request.body)
    const profile = await repository.updateProfile(request.user.id, input)
    if (!profile) {
      return reply.code(404).send({ message: "User not found." })
    }
    return profile
  })

  app.get("/plans", async (request) => await repository.getPlans(request.user.id))

  app.post("/plans", async (request, reply) => {
    const input = createPlanInputSchema.parse(request.body)
    const plan = await repository.createPlan(request.user.id, input)
    return reply.code(201).send(plan)
  })

  app.get("/plans/:id", async (request, reply) => {
    const plan = await repository.getPlan(request.user.id, (request.params as { id: string }).id)
    if (!plan) {
      return reply.code(404).send({ message: "Plan not found." })
    }
    return plan
  })

  app.put("/plans/:id", async (request, reply) => {
    const plan = await repository.updatePlan(
      request.user.id,
      (request.params as { id: string }).id,
      request.body as never,
    )
    if (!plan) {
      return reply.code(404).send({ message: "Plan not found." })
    }
    return plan
  })

  app.put("/plans/:id/days/:dayId", async (request, reply) => {
    const params = request.params as { id: string; dayId: string }
    const input = updatePlanDayInputSchema.parse(request.body)
    const plan = await repository.getPlan(request.user.id, params.id)
    if (!plan) {
      return reply.code(404).send({ message: "Plan not found." })
    }

    const days = plan.days.map((day) =>
      day.id === params.dayId
        ? {
            ...day,
            name: input.name ?? day.name,
            order: input.order ?? day.order,
            exercises: input.exercises
              ? input.exercises.map((exercise) => ({
                  id: exercise.id ?? `plan-exercise-${exercise.exerciseId}`,
                  planDayId: day.id,
                  exerciseId: exercise.exerciseId,
                  exerciseName: exercise.exerciseName,
                  targetSets: exercise.targetSets,
                  targetReps: exercise.targetReps,
                  restSeconds: exercise.restSeconds,
                  notes: exercise.notes,
                }))
              : day.exercises,
          }
        : day,
    )

    return repository.updatePlan(request.user.id, params.id, { days })
  })

  app.post("/plans/:id/activate", async (request, reply) => {
    const plan = await repository.activatePlan(request.user.id, (request.params as { id: string }).id)
    if (!plan) {
      return reply.code(404).send({ message: "Plan not found." })
    }
    return plan
  })

  app.delete("/plans/:id", async (request, reply) => {
    const deleted = await repository.deletePlan(request.user.id, (request.params as { id: string }).id)
    if (!deleted) {
      return reply.code(404).send({ message: "Plan not found." })
    }
    return reply.code(204).send()
  })

  app.get("/home/today", async (request) => await repository.getHome(request.user))

  app.post("/workout-sessions", async (request, reply) => {
    const input = createWorkoutSessionInputSchema.parse(request.body)
    const session = await repository.createWorkoutSession(request.user.id, input)
    if (!session) {
      return reply.code(404).send({ message: "Plan or day not found." })
    }
    return reply.code(201).send(session)
  })

  app.get("/workout-sessions/:id", async (request, reply) => {
    const session = await repository.getWorkoutSession(request.user.id, (request.params as { id: string }).id)
    if (!session) {
      return reply.code(404).send({ message: "Session not found." })
    }
    return session
  })

  app.post("/workout-sessions/:id/exercises/:exerciseId/sets", async (request, reply) => {
    const params = request.params as { id: string; exerciseId: string }
    const input = workoutSetInputSchema.parse(request.body)
    const session = await repository.upsertWorkoutSet(request.user.id, params.id, params.exerciseId, input)
    if (!session) {
      return reply.code(404).send({ message: "Session or exercise not found." })
    }
    return session
  })

  app.post("/workout-sessions/:id/exercises", async (request, reply) => {
    const params = request.params as { id: string }
    const input = createWorkoutExerciseInputSchema.parse(request.body)
    const session = await repository.addWorkoutExercise(request.user.id, params.id, input.exerciseId)
    if (!session) {
      return reply.code(404).send({ message: "Session or exercise not found." })
    }
    return session
  })

  app.put("/workout-sessions/:id", async (request, reply) => {
    const params = request.params as { id: string }
    const input = updateWorkoutSessionInputSchema.parse(request.body)
    const session = await repository.updateWorkoutSession(request.user.id, params.id, input)
    if (!session) {
      return reply.code(404).send({ message: "Session not found." })
    }
    return session
  })

  app.post("/workout-sessions/:id/complete", async (request, reply) => {
    const session = await repository.completeWorkoutSession(request.user.id, (request.params as { id: string }).id)
    if (!session) {
      return reply.code(404).send({ message: "Session not found." })
    }
    return session
  })

  app.get("/history", async (request) => await repository.getHistory(request.user.id))

  app.get("/history/:id", async (request, reply) => {
    const session = await repository.getWorkoutSession(request.user.id, (request.params as { id: string }).id)
    if (!session) {
      return reply.code(404).send({ message: "Session not found." })
    }
    return session
  })

  app.get("/progress/exercises", async (request) => await repository.getProgressExercises(request.user.id))

  app.get("/progress/exercises/:exerciseId", async (request, reply) => {
    const series = await repository.getProgressSeries(
      request.user.id,
      (request.params as { exerciseId: string }).exerciseId,
    )
    if (!series) {
      return reply.code(404).send({ message: "Exercise not found." })
    }
    return series
  })
}
