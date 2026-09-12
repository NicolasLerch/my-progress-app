import { z } from "zod"

export const exerciseTypeSchema = z.enum(["STRENGTH", "CARDIO"])
export const positiveMinutesSchema = z.number().int().positive().max(2147483647)
export const cardioResultInputSchema = z.object({
  durationMinutes: positiveMinutesSchema,
  distanceMeters: z.number().int().nonnegative().max(2147483647).nullish(),
  inclinePercent: z.number().finite().nonnegative().nullish(),
}).strict()

export const planStatusSchema = z.enum(["draft", "active", "archived", "completed"])
export const workoutSessionStatusSchema = z.enum(["in_progress", "completed", "abandoned"])
const targetRepsSchema = z.string().trim().min(1).max(30)
const supersetGroupIdSchema = z.string().trim().min(1).max(100).optional()

const planExerciseInputSchema = z.object({
  order: z.number().int().positive(),
  exerciseId: z.string().min(1),
  exerciseName: z.string().min(2),
  type: exerciseTypeSchema.default("STRENGTH"),
  targetSets: z.number().int().positive().max(2147483647).nullish(),
  targetReps: targetRepsSchema.nullish(),
  restSeconds: z.number().int().nonnegative().max(2147483647).nullish(),
  targetDurationMinutes: positiveMinutesSchema.nullish(),
  targetDistanceMeters: z.number().int().nonnegative().max(2147483647).nullish(),
  targetInclinePercent: z.number().finite().nonnegative().nullish(),
  supersetGroupId: supersetGroupIdSchema,
  notes: z.string().max(300).optional(),
})

function validatePlanExercises(
  exercises: Array<z.infer<typeof planExerciseInputSchema>>,
  context: z.RefinementCtx,
) {
  const orders = new Set<number>()
  exercises.forEach((exercise, index) => {
    const invalidFields = exercise.type === "CARDIO"
      ? [
          ...(!exercise.targetDurationMinutes ? ["targetDurationMinutes"] : []),
          ...(["targetSets", "targetReps", "restSeconds", "supersetGroupId"] as const).filter((key) => exercise[key] != null),
        ]
      : [
          ...(["targetSets", "targetReps", "restSeconds"] as const).filter((key) => exercise[key] == null),
          ...(["targetDurationMinutes", "targetDistanceMeters", "targetInclinePercent"] as const).filter((key) => exercise[key] != null),
        ]
    invalidFields.forEach((field) => context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El objetivo no corresponde al tipo de ejercicio o falta completarlo.",
      path: [index, field],
    }))
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

  const groups = new Map<string, Array<{ exercise: z.infer<typeof planExerciseInputSchema>; index: number }>>()
  exercises.forEach((exercise, index) => {
    if (!exercise.supersetGroupId) return
    const members = groups.get(exercise.supersetGroupId) ?? []
    members.push({ exercise, index })
    groups.set(exercise.supersetGroupId, members)
  })

  groups.forEach((members, groupId) => {
    const sortedMembers = [...members].sort((left, right) => left.exercise.order - right.exercise.order)
    const [first, second] = sortedMembers
    const invalid =
      members.length !== 2 ||
      !first ||
      !second ||
      second.exercise.order !== first.exercise.order + 1 ||
      second.exercise.targetSets !== first.exercise.targetSets ||
      second.exercise.restSeconds !== first.exercise.restSeconds

    if (invalid) {
      members.forEach(({ index }) => {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `La superserie ${groupId} debe tener dos ejercicios consecutivos con las mismas series y descanso.`,
          path: [index, "supersetGroupId"],
        })
      })
    }
  })
}

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
      exercises: z.array(planExerciseInputSchema).min(1).superRefine(validatePlanExercises),
    }),
  ).min(1),
})

export const updatePlanDayInputSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  order: z.number().int().positive().optional(),
  exercises: z.array(planExerciseInputSchema.extend({ id: z.string().optional() })).superRefine(validatePlanExercises).optional(),
})

export const updateWorkoutSessionInputSchema = z.object({
  notes: z.string().max(500).optional(),
  status: workoutSessionStatusSchema.optional(),
})

export const updateUserProfileInputSchema = z.object({
  weight: z.number().positive().max(500).optional(),
  height: z.number().positive().max(300).optional(),
})
