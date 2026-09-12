import type { FastifyInstance } from "fastify"
import {
  createPlanInputSchema,
  cardioResultInputSchema,
  createWorkoutExerciseInputSchema,
  createWorkoutSessionInputSchema,
  replaceWorkoutExerciseInputSchema,
  updatePlanDayInputSchema,
  updateUserProfileInputSchema,
  updateWorkoutSessionInputSchema,
  workoutSetInputSchema,
} from "@my-progress/shared"
import { z } from "zod"
import { prisma } from "./lib/prisma.js"
import { requireUser } from "./plugins/auth.js"
import { PrismaRepository } from "./repositories/prisma-repository.js"
import { registerRoutineImport } from './services/routine-import/routes.js'
import { FileImportService } from './services/routine-import/service.js'
import { RoutineImportError } from './services/routine-import/errors.js'

const exerciseSearchQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export async function registerRoutes(app: FastifyInstance) {
  const repository = new PrismaRepository(prisma)

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ message: "Revisa los datos ingresados.", issues: error.issues })
    request.log.error(error)
    const status = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500
    return reply.code(status).send({ message: status < 500 && error instanceof Error ? error.message : "No se pudo completar la operacion." })
  })

  app.addHook("preHandler", requireUser)
  await registerRoutineImport(app, new FileImportService(() => prisma.exercise.findMany({ select: { id: true, name: true, muscleGroup: true, type: true } })))

  app.get("/health", async () => ({ ok: true }))

  app.get("/exercises", async (request) => {
    const query = exerciseSearchQuerySchema.parse(request.query)
    return repository.getExercises(query)
  })

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
    const parsed = createPlanInputSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_PLAN', message: 'Revisá los datos del plan.', issues: parsed.error.issues })
    try {
      const plan = await repository.createPlan(request.user.id, parsed.data)
      return reply.code(201).send(plan)
    } catch (error: unknown) {
      if (error instanceof z.ZodError || (error instanceof Error && "statusCode" in error && error.statusCode === 400)) throw error
      if (error instanceof RoutineImportError) return reply.code(error.statusCode).send({ code: error.code, message: error.message })
      request.log.error({ code: 'PLAN_CREATE_FAILED' }, 'Plan creation failed')
      return reply.code(500).send({ code: 'PLAN_CREATE_FAILED', message: 'No se pudo crear el plan. Revisá los ejercicios e intentá nuevamente.' })
    }
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
                  order: exercise.order,
                  exerciseId: exercise.exerciseId,
                  exerciseName: exercise.exerciseName,
                  type: exercise.type,
                  targetDurationMinutes: exercise.targetDurationMinutes,
                  targetDistanceMeters: exercise.targetDistanceMeters,
                  targetInclinePercent: exercise.targetInclinePercent,
                  targetSets: exercise.targetSets ?? null,
                  targetReps: exercise.targetReps ?? null,
                  restSeconds: exercise.restSeconds ?? null,
                  supersetGroupId: exercise.supersetGroupId,
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

  app.put("/workout-sessions/:id/exercises/:workoutExerciseId/cardio-result", async (request, reply) => {
    const params = request.params as { id: string; workoutExerciseId: string }
    const input = cardioResultInputSchema.parse(request.body)
    const session = await repository.upsertCardioResult(request.user.id, params.id, params.workoutExerciseId, input)
    if (!session) return reply.code(404).send({ message: "Session or exercise not found." })
    return session
  })

  app.post("/workout-sessions/:id/exercises/:workoutExerciseId/sets", async (request, reply) => {
    const params = request.params as { id: string; workoutExerciseId: string }
    const input = workoutSetInputSchema.parse(request.body)
    const session = await repository.upsertWorkoutSet(request.user.id, params.id, params.workoutExerciseId, input)
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

  app.post("/workout-sessions/:id/exercises/:workoutExerciseId/replace", async (request, reply) => {
    const params = request.params as { id: string; workoutExerciseId: string }
    const input = replaceWorkoutExerciseInputSchema.parse(request.body)

    try {
      const session = await repository.replaceWorkoutExercise(request.user.id, params.id, params.workoutExerciseId, input)
      if (!session) {
        return reply.code(404).send({ message: "Session or exercise not found." })
      }
      return session
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(400).send({ message: error.message })
      }
      throw error
    }
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

  app.get("/progress/exercises", async (request) => {
    const query = exerciseSearchQuerySchema.parse(request.query)
    return repository.getProgressExercises(request.user.id, query)
  })

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
