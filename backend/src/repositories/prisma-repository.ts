import prismaClientPkg from "@prisma/client"
import type { Prisma as PrismaNamespace, PrismaClient as PrismaClientType } from "@prisma/client"
import {
  buildProgressSeries,
  calculateSessionVolume,
  createPlanInputSchema,
  demoUser,
  type CreatePlanInputDTO,
  type CreatePlannedWorkoutSessionInputDTO,
  type CreateWorkoutSessionInputDTO,
  type ExerciseDTO,
  type HistoryItemDTO,
  type HomeTodayDTO,
  type PlanDTO,
  type PlanExerciseDTO,
  type ProgressSeriesDTO,
  type ReplaceWorkoutExerciseInputDTO,
  type UpdateUserProfileInputDTO,
  type UserProfileDTO,
  type UserDTO,
  type WorkoutSessionDTO,
  type WorkoutSetInputDTO,
} from "@my-progress/shared"

const { Prisma } = prismaClientPkg

const planInclude = {
  days: {
    orderBy: { order: "asc" },
    include: {
      exercises: {
        include: {
          exercise: true,
        },
      },
    },
  },
} satisfies PrismaNamespace.PlanInclude

const workoutSessionInclude = {
  exercises: {
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: {
      sets: {
        orderBy: { setNumber: "asc" },
      },
    },
  },
} satisfies PrismaNamespace.WorkoutSessionInclude

type PlanWithRelations = PrismaNamespace.PlanGetPayload<{ include: typeof planInclude }>
type WorkoutSessionWithRelations = PrismaNamespace.WorkoutSessionGetPayload<{ include: typeof workoutSessionInclude }>
type ExerciseSearchOptions = {
  query?: string
  limit?: number
}

function toIsoString(value: Date | null | undefined) {
  return value?.toISOString()
}

function decimalToNumber(value: PrismaNamespace.Decimal | number) {
  return typeof value === "number" ? value : value.toNumber()
}

function mapUser(user: {
  id: string
  email: string
  name: string
  lastName?: string | null
  birthDate?: string | Date | null
  weight?: PrismaNamespace.Decimal | number | null
  height?: PrismaNamespace.Decimal | number | null
  createdAt?: string | Date
}): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    lastName: user.lastName ?? undefined,
    birthDate:
      user.birthDate instanceof Date
        ? user.birthDate.toISOString().slice(0, 10)
        : (user.birthDate ?? undefined),
    weight: user.weight == null ? undefined : decimalToNumber(user.weight),
    height: user.height == null ? undefined : decimalToNumber(user.height),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : (user.createdAt ?? demoUser.createdAt),
  }
}

function calculateBmi(weight?: number, height?: number) {
  if (!weight || !height || height <= 0) {
    return undefined
  }

  const meters = height / 100
  return Number((weight / (meters * meters)).toFixed(1))
}

function mapPlanExercise(exercise: PlanWithRelations["days"][number]["exercises"][number]): PlanExerciseDTO {
  return {
    id: exercise.id,
    planDayId: exercise.planDayId,
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exercise.name,
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
    restSeconds: exercise.restSeconds,
    notes: exercise.notes ?? undefined,
  }
}

function mapPlan(plan: PlanWithRelations): PlanDTO {
  return {
    id: plan.id,
    userId: plan.userId,
    name: plan.name,
    startDate: plan.startDate.toISOString(),
    endDate: toIsoString(plan.endDate),
    status: plan.status,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    currentDay: plan.currentDay,
    totalDays: plan.totalDays,
    days: plan.days.map((day) => ({
      id: day.id,
      planId: day.planId,
      name: day.name,
      order: day.order,
      exercises: day.exercises.map(mapPlanExercise),
    })),
  }
}

function mapWorkoutSession(session: WorkoutSessionWithRelations): WorkoutSessionDTO {
  return {
    id: session.id,
    userId: session.userId,
    planId: session.planId ?? undefined,
    planDayId: session.planDayId ?? undefined,
    date: session.date.toISOString(),
    notes: session.notes ?? undefined,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    completedAt: toIsoString(session.completedAt),
    planName: session.planName,
    dayName: session.dayName,
    durationMinutes: session.durationMinutes ?? undefined,
    exercises: session.exercises.map((exercise) => ({
      id: exercise.id,
      workoutSessionId: exercise.workoutSessionId,
      position: exercise.position,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      planExerciseId: exercise.planExerciseId ?? undefined,
      replacesPlanExerciseId: exercise.replacesPlanExerciseId ?? undefined,
      replacementReason: exercise.replacementReason ?? undefined,
      isReplacement: exercise.isReplacement,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      restSeconds: exercise.restSeconds,
      notes: exercise.notes ?? undefined,
      sets: exercise.sets.map((set) => ({
        id: set.id,
        workoutExerciseId: set.workoutExerciseId,
        setNumber: set.setNumber,
        weight: decimalToNumber(set.weight),
        reps: set.reps,
        rir: set.rir ?? undefined,
        notes: set.notes ?? undefined,
        createdAt: set.createdAt.toISOString(),
        updatedAt: set.updatedAt.toISOString(),
      })),
    })),
  }
}

function minutesBetween(startedAt: Date, completedAt: Date) {
  return Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000))
}

function buildExerciseSearchWhere(query?: string): PrismaNamespace.ExerciseWhereInput | undefined {
  const search = query?.trim()
  if (!search) {
    return undefined
  }

  return {
    OR: [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        muscleGroup: {
          contains: search,
          mode: "insensitive",
        },
      },
    ],
  }
}

export class PrismaRepository {
  constructor(private readonly prisma: PrismaClientType) {}

  async getExercises(options: ExerciseSearchOptions = {}): Promise<ExerciseDTO[]> {
    const exercises = await this.prisma.exercise.findMany({
      where: buildExerciseSearchWhere(options.query),
      orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
      take: options.limit ?? 20,
    })

    return exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
    }))
  }

  async getPlans(userId: string): Promise<PlanDTO[]> {
    const plans = await this.prisma.plan.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      include: planInclude,
    })

    return plans.map(mapPlan)
  }

  async getPlan(userId: string, planId: string): Promise<PlanDTO | null> {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, userId },
      include: planInclude,
    })

    return plan ? mapPlan(plan) : null
  }

  async createPlan(userId: string, input: CreatePlanInputDTO): Promise<PlanDTO> {
    const parsed = createPlanInputSchema.parse(input)

    await this.ensureUser({ id: userId })

    const plan = await this.prisma.$transaction(async (tx) => {
      if (parsed.status === "active") {
        await tx.plan.updateMany({
          where: { userId, status: "active" },
          data: { status: "archived" },
        })
      }

      return tx.plan.create({
        data: {
          userId,
          name: parsed.name,
          startDate: new Date(parsed.startDate),
          endDate: parsed.endDate ? new Date(parsed.endDate) : null,
          status: parsed.status ?? "draft",
          currentDay: parsed.currentDay ?? 1,
          totalDays: parsed.days.length,
          days: {
            create: parsed.days
              .sort((a, b) => a.order - b.order)
              .map((day) => ({
                name: day.name,
                order: day.order,
                exercises: {
                  create: day.exercises.map((exercise) => ({
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
        include: planInclude,
      })
    })

    return mapPlan(plan)
  }

  async updatePlan(userId: string, planId: string, partial: Partial<PlanDTO>): Promise<PlanDTO | null> {
    const existing = await this.prisma.plan.findFirst({
      where: { id: planId, userId },
      include: planInclude,
    })

    if (!existing) {
      return null
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      if (partial.status === "active") {
        await tx.plan.updateMany({
          where: { userId, status: "active", id: { not: planId } },
          data: { status: "archived" },
        })
      }

      await tx.plan.update({
        where: { id: planId },
        data: {
          name: partial.name,
          startDate: partial.startDate ? new Date(partial.startDate) : undefined,
          endDate: partial.endDate === undefined ? undefined : partial.endDate ? new Date(partial.endDate) : null,
          status: partial.status,
          currentDay: partial.currentDay,
          totalDays: partial.days?.length ?? partial.totalDays,
        },
      })

      if (partial.days) {
        const existingDayIds = new Set(existing.days.map((day) => day.id))
        const incomingDayIds = new Set(partial.days.map((day) => day.id))
        const removedDayIds = existing.days
          .map((day) => day.id)
          .filter((dayId) => !incomingDayIds.has(dayId))

        if (removedDayIds.length > 0) {
          const linkedSessions = await tx.workoutSession.count({
            where: {
              userId,
              planId,
              planDayId: {
                in: removedDayIds,
              },
            },
          })

          if (linkedSessions > 0) {
            throw new Error("No se pueden eliminar dias que ya tienen entrenamientos registrados.")
          }

          await tx.planExercise.deleteMany({
            where: {
              planDayId: {
                in: removedDayIds,
              },
            },
          })

          await tx.planDay.deleteMany({
            where: {
              id: {
                in: removedDayIds,
              },
            },
          })
        }

        for (const day of partial.days) {
          if (existingDayIds.has(day.id)) {
            await tx.planDay.update({
              where: { id: day.id },
              data: {
                name: day.name,
                order: day.order,
              },
            })
          } else {
            await tx.planDay.create({
              data: {
                id: day.id,
                planId,
                name: day.name,
                order: day.order,
              },
            })
          }

          const existingDay = existing.days.find((item) => item.id === day.id)
          const existingExerciseIds = new Set(existingDay?.exercises.map((exercise) => exercise.id) ?? [])
          const incomingExerciseIds = new Set(day.exercises.map((exercise) => exercise.id))
          const removedExerciseIds = [...existingExerciseIds].filter((exerciseId) => !incomingExerciseIds.has(exerciseId))

          if (removedExerciseIds.length > 0) {
            await tx.planExercise.deleteMany({
              where: {
                id: {
                  in: removedExerciseIds,
                },
              },
            })
          }

          for (const exercise of day.exercises) {
            if (existingExerciseIds.has(exercise.id)) {
              await tx.planExercise.update({
                where: { id: exercise.id },
                data: {
                  exerciseId: exercise.exerciseId,
                  targetSets: exercise.targetSets,
                  targetReps: exercise.targetReps,
                  restSeconds: exercise.restSeconds,
                  notes: exercise.notes,
                },
              })
            } else {
              await tx.planExercise.create({
                data: {
                  id: exercise.id,
                  planDayId: day.id,
                  exerciseId: exercise.exerciseId,
                  targetSets: exercise.targetSets,
                  targetReps: exercise.targetReps,
                  restSeconds: exercise.restSeconds,
                  notes: exercise.notes,
                },
              })
            }
          }
        }
      }

      return tx.plan.findUniqueOrThrow({
        where: { id: planId },
        include: planInclude,
      })
    })

    return mapPlan(plan)
  }

  async activatePlan(userId: string, planId: string): Promise<PlanDTO | null> {
    const existing = await this.prisma.plan.findFirst({
      where: { id: planId, userId },
    })

    if (!existing) {
      return null
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.plan.updateMany({
        where: { userId, status: "active", id: { not: planId } },
        data: { status: "archived" },
      })

      await tx.plan.update({
        where: { id: planId },
        data: { status: "active" },
      })

      return tx.plan.findUniqueOrThrow({
        where: { id: planId },
        include: planInclude,
      })
    })

    return mapPlan(plan)
  }

  async archivePlan(userId: string, planId: string): Promise<PlanDTO | null> {
    return this.updatePlan(userId, planId, { status: "archived" })
  }

  async deletePlan(userId: string, planId: string): Promise<boolean> {
    const existing = await this.prisma.plan.findFirst({
      where: { id: planId, userId },
      select: { id: true },
    })

    if (!existing) {
      return false
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutSession.deleteMany({
        where: { userId, planId },
      })

      await tx.plan.delete({
        where: { id: planId },
      })
    })

    return true
  }

  async getHome(user: { id: string; email: string; name: string; lastName?: string; birthDate?: string }): Promise<HomeTodayDTO> {
    await this.ensureUser(user)

    const [dbUser, activePlan, currentSession, recentSessions, completedCount, volumeRows] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id } }),
      this.prisma.plan.findFirst({
        where: { userId: user.id, status: "active" },
        include: planInclude,
      }),
      this.prisma.workoutSession.findFirst({
        where: { userId: user.id, status: "in_progress" },
        orderBy: { startedAt: "desc" },
        include: workoutSessionInclude,
      }),
      this.prisma.workoutSession.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 4,
        include: workoutSessionInclude,
      }),
      this.prisma.workoutSession.count({
        where: { userId: user.id, status: "completed" },
      }),
      this.prisma.workoutSet.findMany({
        where: {
          workoutExercise: {
            workoutSession: {
              userId: user.id,
            },
          },
        },
        select: {
          weight: true,
          reps: true,
        },
      }),
    ])

    const totalWeightLifted = volumeRows.reduce(
      (total, set) => total + decimalToNumber(set.weight) * set.reps,
      0,
    )

    const mappedActivePlan = activePlan ? mapPlan(activePlan) : undefined

    return {
      user: mapUser(dbUser ?? { ...user, createdAt: demoUser.createdAt }),
      activePlan: mappedActivePlan,
      todayDay: mappedActivePlan?.days.find((day) => day.order === mappedActivePlan.currentDay),
      currentSession: currentSession ? mapWorkoutSession(currentSession) : undefined,
      recentSessions: recentSessions.map(mapWorkoutSession),
      stats: {
        totalWorkouts: completedCount,
        currentStreak: Math.min(completedCount, 4),
        totalWeightLifted,
      },
    }
  }

  async getProfile(user: {
    id: string
    email: string
    name: string
    lastName?: string
    birthDate?: string
    weight?: number
    height?: number
  }): Promise<UserProfileDTO> {
    await this.ensureUser(user)

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    })

    const mappedUser = mapUser(dbUser ?? { ...user, createdAt: demoUser.createdAt })

    return {
      user: mappedUser,
      bmi: calculateBmi(mappedUser.weight, mappedUser.height),
    }
  }

  async updateProfile(
    userId: string,
    input: UpdateUserProfileInputDTO,
  ): Promise<UserProfileDTO | null> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!existing) {
      return null
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        weight: input.weight == null ? null : new Prisma.Decimal(input.weight),
        height: input.height == null ? null : new Prisma.Decimal(input.height),
      },
    })

    const mappedUser = mapUser(updatedUser)

    return {
      user: mappedUser,
      bmi: calculateBmi(mappedUser.weight, mappedUser.height),
    }
  }

  async createWorkoutSession(userId: string, input: CreateWorkoutSessionInputDTO): Promise<WorkoutSessionDTO | null> {
    await this.ensureUser({ id: userId })

    if ("mode" in input && input.mode === "planless") {
      const session = await this.prisma.workoutSession.create({
        data: {
          userId,
          planId: null,
          planDayId: null,
          date: new Date(input.date),
          status: "in_progress",
          startedAt: new Date(input.date),
          planName: "Entrenamiento libre",
          dayName: "Entrenamiento libre",
        },
        include: workoutSessionInclude,
      })

      return mapWorkoutSession(session)
    }

    const plannedInput = input as CreatePlannedWorkoutSessionInputDTO

    const plan = await this.prisma.plan.findFirst({
      where: { id: plannedInput.planId, userId },
      include: planInclude,
    })

    const day = plan?.days.find((item) => item.id === plannedInput.planDayId)

    if (!plan || !day) {
      return null
    }

    const session = await this.prisma.workoutSession.create({
      data: {
        userId,
        planId: plan.id,
        planDayId: day.id,
        date: new Date(plannedInput.date),
        status: "in_progress",
        startedAt: new Date(plannedInput.date),
        planName: plan.name,
        dayName: day.name,
        exercises: {
          create: day.exercises.map((exercise, index) => ({
            position: index + 1,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exercise.name,
            planExerciseId: exercise.id,
            isReplacement: false,
            targetSets: exercise.targetSets,
            targetReps: exercise.targetReps,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
          })),
        },
      },
      include: workoutSessionInclude,
    })

    return mapWorkoutSession(session)
  }

  async addWorkoutExercise(
    userId: string,
    sessionId: string,
    exerciseId: string,
  ): Promise<WorkoutSessionDTO | null> {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    })

    if (!session) {
      return null
    }

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, name: true },
    })

    if (!exercise) {
      return null
    }

    const position = await this.prisma.workoutExercise.count({
      where: {
        workoutSessionId: sessionId,
      },
    })

    await this.prisma.workoutExercise.create({
      data: {
        workoutSessionId: sessionId,
        position: position + 1,
        exerciseId,
        exerciseName: exercise.name,
        isReplacement: false,
        targetSets: 0,
        targetReps: "",
        restSeconds: 0,
      },
    })

    return this.getWorkoutSession(userId, sessionId)
  }

  async replaceWorkoutExercise(
    userId: string,
    sessionId: string,
    workoutExerciseId: string,
    input: ReplaceWorkoutExerciseInputDTO,
  ): Promise<WorkoutSessionDTO | null> {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, planId: true },
    })

    if (!session) {
      return null
    }

    const workoutExercise = await this.prisma.workoutExercise.findFirst({
      where: {
        id: workoutExerciseId,
        workoutSessionId: sessionId,
      },
      include: {
        sets: {
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!workoutExercise) {
      return null
    }

    if (workoutExercise.sets.length > 0) {
      throw new Error("No se puede cambiar un ejercicio que ya tiene series guardadas.")
    }

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: input.exerciseId },
      select: { id: true, name: true },
    })

    if (!exercise) {
      return null
    }

    await this.prisma.workoutExercise.update({
      where: { id: workoutExerciseId },
      data: {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        replacesPlanExerciseId: workoutExercise.planExerciseId ?? workoutExercise.replacesPlanExerciseId,
        isReplacement: true,
      },
    })

    return this.getWorkoutSession(userId, sessionId)
  }

  async getWorkoutSession(userId: string, sessionId: string): Promise<WorkoutSessionDTO | null> {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: workoutSessionInclude,
    })

    return session ? mapWorkoutSession(session) : null
  }

  async upsertWorkoutSet(
    userId: string,
    sessionId: string,
    workoutExerciseId: string,
    payload: WorkoutSetInputDTO,
  ): Promise<WorkoutSessionDTO | null> {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    })

    if (!session) {
      return null
    }

    const workoutExercise = await this.prisma.workoutExercise.findFirst({
      where: {
        id: workoutExerciseId,
        workoutSessionId: sessionId,
      },
      select: { id: true },
    })

    if (!workoutExercise) {
      return null
    }

    await this.prisma.workoutSet.upsert({
      where: {
        workoutExerciseId_setNumber: {
          workoutExerciseId: workoutExercise.id,
          setNumber: payload.setNumber,
        },
      },
      create: {
        id: payload.id,
        workoutExerciseId: workoutExercise.id,
        setNumber: payload.setNumber,
        weight: new Prisma.Decimal(payload.weight),
        reps: payload.reps,
        rir: payload.rir,
        notes: payload.notes,
        createdAt: new Date(payload.updatedAt),
        updatedAt: new Date(payload.updatedAt),
      },
      update: {
        weight: new Prisma.Decimal(payload.weight),
        reps: payload.reps,
        rir: payload.rir,
        notes: payload.notes,
        updatedAt: new Date(payload.updatedAt),
      },
    })

    return this.getWorkoutSession(userId, sessionId)
  }

  async updateWorkoutSession(
    userId: string,
    sessionId: string,
    partial: Partial<WorkoutSessionDTO>,
  ): Promise<WorkoutSessionDTO | null> {
    const existing = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    })

    if (!existing) {
      return null
    }

    const session = await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        notes: partial.notes,
        status: partial.status,
      },
      include: workoutSessionInclude,
    })

    return mapWorkoutSession(session)
  }

  async completeWorkoutSession(userId: string, sessionId: string): Promise<WorkoutSessionDTO | null> {
    const existing = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, startedAt: true },
    })

    if (!existing) {
      return null
    }

    const completedAt = new Date()
    const session = await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        completedAt,
        durationMinutes: minutesBetween(existing.startedAt, completedAt),
      },
      include: workoutSessionInclude,
    })

    return mapWorkoutSession(session)
  }

  async getHistory(userId: string): Promise<HistoryItemDTO[]> {
    const sessions = await this.prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: workoutSessionInclude,
    })

    return sessions.map((session) => {
      const dto = mapWorkoutSession(session)
      return {
        id: dto.id,
        date: dto.date,
        planName: dto.planName,
        dayName: dto.dayName,
        durationMinutes: dto.durationMinutes ?? 0,
        totalVolume: calculateSessionVolume(dto),
        exerciseCount: dto.exercises.length,
        status: dto.status,
      }
    })
  }

  async getProgressExercises(userId: string, options: ExerciseSearchOptions = {}): Promise<ExerciseDTO[]> {
    const exercises = await this.prisma.exercise.findMany({
      where: {
        ...buildExerciseSearchWhere(options.query),
        workoutExercises: {
          some: {
            workoutSession: {
              userId,
            },
          },
        },
      },
      orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
      take: options.limit ?? 20,
    })

    return exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
    }))
  }

  async getProgressSeries(userId: string, exerciseId: string): Promise<ProgressSeriesDTO | null> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    })

    if (!exercise) {
      return null
    }

    const rows = await this.prisma.workoutExercise.findMany({
      where: {
        exerciseId,
        workoutSession: {
          userId,
          status: "completed",
        },
      },
      orderBy: {
        workoutSession: {
          date: "asc",
        },
      },
      include: {
        sets: {
          orderBy: { setNumber: "asc" },
        },
        workoutSession: true,
      },
    })

    const sessions: WorkoutSessionDTO[] = rows.map((row) => ({
      id: row.workoutSession.id,
      userId: row.workoutSession.userId,
      planId: row.workoutSession.planId ?? undefined,
      planDayId: row.workoutSession.planDayId ?? undefined,
      date: row.workoutSession.date.toISOString(),
      notes: row.workoutSession.notes ?? undefined,
      status: row.workoutSession.status,
      startedAt: row.workoutSession.startedAt.toISOString(),
      completedAt: toIsoString(row.workoutSession.completedAt),
      planName: row.workoutSession.planName,
      dayName: row.workoutSession.dayName,
      durationMinutes: row.workoutSession.durationMinutes ?? undefined,
      exercises: [
        {
          id: row.id,
          workoutSessionId: row.workoutSessionId,
          position: row.position,
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName,
          planExerciseId: row.planExerciseId ?? undefined,
          replacesPlanExerciseId: row.replacesPlanExerciseId ?? undefined,
          replacementReason: row.replacementReason ?? undefined,
          isReplacement: row.isReplacement,
          targetSets: row.targetSets,
          targetReps: row.targetReps,
          restSeconds: row.restSeconds,
          notes: row.notes ?? undefined,
          sets: row.sets.map((set) => ({
            id: set.id,
            workoutExerciseId: set.workoutExerciseId,
            setNumber: set.setNumber,
            weight: decimalToNumber(set.weight),
            reps: set.reps,
            rir: set.rir ?? undefined,
            notes: set.notes ?? undefined,
            createdAt: set.createdAt.toISOString(),
            updatedAt: set.updatedAt.toISOString(),
          })),
        },
      ],
    }))

    return buildProgressSeries(
      {
        id: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
      },
      sessions,
    )
  }

  private async ensureUser(user: {
    id: string
    email?: string
    name?: string
    lastName?: string
    birthDate?: string
    weight?: number
    height?: number
  }) {
    const fallbackEmail = user.id === demoUser.id ? demoUser.email : `${user.id}@local.app`
    const fallbackName = user.id === demoUser.id ? demoUser.name : "Usuario"
    const fallbackLastName = user.id === demoUser.id ? demoUser.lastName : undefined
    const fallbackBirthDate = user.id === demoUser.id ? demoUser.birthDate : undefined
    const fallbackWeight = user.id === demoUser.id ? demoUser.weight : undefined
    const fallbackHeight = user.id === demoUser.id ? demoUser.height : undefined

    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? fallbackEmail,
        name: user.name ?? fallbackName,
        lastName: user.lastName ?? fallbackLastName,
        birthDate: user.birthDate ? new Date(user.birthDate) : fallbackBirthDate ? new Date(fallbackBirthDate) : null,
        weight: user.weight != null ? new Prisma.Decimal(user.weight) : fallbackWeight != null ? new Prisma.Decimal(fallbackWeight) : null,
        height: user.height != null ? new Prisma.Decimal(user.height) : fallbackHeight != null ? new Prisma.Decimal(fallbackHeight) : null,
        createdAt: new Date(demoUser.createdAt),
      },
      update: {
        email: user.email ?? fallbackEmail,
        name: user.name ?? fallbackName,
        lastName: user.lastName ?? fallbackLastName,
        birthDate: user.birthDate ? new Date(user.birthDate) : fallbackBirthDate ? new Date(fallbackBirthDate) : undefined,
        weight: user.weight != null ? new Prisma.Decimal(user.weight) : fallbackWeight != null ? new Prisma.Decimal(fallbackWeight) : undefined,
        height: user.height != null ? new Prisma.Decimal(user.height) : fallbackHeight != null ? new Prisma.Decimal(fallbackHeight) : undefined,
      },
    })
  }
}
