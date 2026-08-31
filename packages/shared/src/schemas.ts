import { z } from "zod"

export const planStatusSchema = z.enum(["draft", "active", "archived", "completed"])
export const workoutSessionStatusSchema = z.enum(["in_progress", "completed", "abandoned"])
const targetRepsSchema = z.string().trim().min(1).max(30)

export const workoutSetInputSchema = z.object({
  id: z.string().optional(),
  setNumber: z.number().int().positive(),
  weight: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  rir: z.number().int().min(0).max(10).optional(),
  notes: z.string().max(300).optional(),
  updatedAt: z.string().datetime(),
})

export const createWorkoutSessionInputSchema = z.union([
  z.object({
    planId: z.string().min(1),
    planDayId: z.string().min(1),
    date: z.string().datetime(),
  }),
  z.object({
    mode: z.literal("planless"),
    date: z.string().datetime(),
  }),
])

export const createWorkoutExerciseInputSchema = z.object({
  exerciseId: z.string().min(1),
})

export const replaceWorkoutExerciseInputSchema = z.object({
  exerciseId: z.string().min(1),
})

export const createPlanInputSchema = z.object({
  name: z.string().min(2).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  status: planStatusSchema.optional(),
  currentDay: z.number().int().positive().optional(),
  days: z.array(
    z.object({
      name: z.string().min(2).max(100),
      order: z.number().int().positive(),
      exercises: z.array(
        z.object({
          order: z.number().int().positive(),
          exerciseId: z.string().min(1),
          exerciseName: z.string().min(2),
          targetSets: z.number().int().positive(),
          targetReps: targetRepsSchema,
          restSeconds: z.number().int().nonnegative(),
          notes: z.string().max(300).optional(),
        }),
      ).min(1).superRefine((exercises, context) => {
        const orders = new Set<number>()
        exercises.forEach((exercise, index) => {
          if (orders.has(exercise.order)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "El orden de los ejercicios debe ser unico dentro del dia.",
              path: [index, "order"],
            })
          }
          orders.add(exercise.order)
        })

        const sortedOrders = [...orders].sort((left, right) => left - right)
        if (sortedOrders.some((order, index) => order !== index + 1)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El orden de los ejercicios debe ser consecutivo y comenzar en 1.",
          })
        }
      }),
    }),
  ).min(1),
})

export const updatePlanDayInputSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  order: z.number().int().positive().optional(),
  exercises: z.array(
    z.object({
      id: z.string().optional(),
      order: z.number().int().positive(),
      exerciseId: z.string().min(1),
      exerciseName: z.string().min(2),
      targetSets: z.number().int().positive(),
      targetReps: targetRepsSchema,
      restSeconds: z.number().int().nonnegative(),
      notes: z.string().max(300).optional(),
    }),
  ).superRefine((exercises, context) => {
    const orders = new Set<number>()
    exercises.forEach((exercise, index) => {
      if (orders.has(exercise.order)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El orden de los ejercicios debe ser unico dentro del dia.",
          path: [index, "order"],
        })
      }
      orders.add(exercise.order)
    })

    const sortedOrders = [...orders].sort((left, right) => left - right)
    if (sortedOrders.some((order, index) => order !== index + 1)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El orden de los ejercicios debe ser consecutivo y comenzar en 1.",
      })
    }
  }).optional(),
})

export const updateWorkoutSessionInputSchema = z.object({
  notes: z.string().max(500).optional(),
  status: workoutSessionStatusSchema.optional(),
})

export const updateUserProfileInputSchema = z.object({
  weight: z.number().positive().max(500).optional(),
  height: z.number().positive().max(300).optional(),
})
