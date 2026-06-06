import { Prisma, type PrismaClient } from "@prisma/client"
import {
  buildProgressSeries,
  calculateSessionVolume,
  createPlanInputSchema,
  demoUser,
  type CreatePlanInputDTO,
  type CreateWorkoutSessionInputDTO,
  type ExerciseDTO,
  type HistoryItemDTO,
  type HomeTodayDTO,
  type PlanDTO,
  type PlanExerciseDTO,
  type ProgressSeriesDTO,
  type UserDTO,
  type WorkoutSessionDTO,
  type WorkoutSetInputDTO,
} from "@my-progress/shared"

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
} satisfies Prisma.PlanInclude

const workoutSessionInclude = {
  exercises: {
    orderBy: { id: "asc" },
    include: {
      sets: {
        orderBy: { setNumber: "asc" },
      },
    },
  },
} satisfies Prisma.WorkoutSessionInclude

type PlanWithRelations = Prisma.PlanGetPayload<{ include: typeof planInclude }>
type WorkoutSessionWithRelations = Prisma.WorkoutSessionGetPayload<{ include: typeof workoutSessionInclude }>

function toIsoString(value: Date | null | undefined) {
  return value?.toISOString()
}

function decimalToNumber(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : value.toNumber()
}

function mapUser(user: { id: string; email: string; name: string; createdAt?: string | Date }): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : (user.createdAt ?? demoUser.createdAt),
  }
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
    planId: session.planId,
    planDayId: session.planDayId,
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
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      planExerciseId: exercise.planExerciseId ?? undefined,
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

export class PrismaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getExercises(): Promise<ExerciseDTO[]> {
    const exercises = await this.prisma.exercise.findMany({
      orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
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
        await tx.planExercise.deleteMany({
          where: {
            planDay: {
              planId,
            },
          },
        })

        await tx.planDay.deleteMany({
          where: { planId },
        })

        await tx.planDay.createMany({
          data: partial.days.map((day) => ({
            id: day.id,
            planId,
            name: day.name,
            order: day.order,
          })),
        })

        for (const day of partial.days) {
          if (day.exercises.length === 0) {
            continue
          }

          await tx.planExercise.createMany({
            data: day.exercises.map((exercise) => ({
              id: exercise.id,
              planDayId: day.id,
              exerciseId: exercise.exerciseId,
              targetSets: exercise.targetSets,
              targetReps: exercise.targetReps,
              restSeconds: exercise.restSeconds,
              notes: exercise.notes,
            })),
          })
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

  async getHome(user: { id: string; email: string; name: string }): Promise<HomeTodayDTO> {
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

  async createWorkoutSession(userId: string, input: CreateWorkoutSessionInputDTO): Promise<WorkoutSessionDTO | null> {
    await this.ensureUser({ id: userId })

    const plan = await this.prisma.plan.findFirst({
      where: { id: input.planId, userId },
      include: planInclude,
    })

    const day = plan?.days.find((item) => item.id === input.planDayId)

    if (!plan || !day) {
      return null
    }

    const session = await this.prisma.workoutSession.create({
      data: {
        userId,
        planId: plan.id,
        planDayId: day.id,
        date: new Date(input.date),
        status: "in_progress",
        startedAt: new Date(input.date),
        planName: plan.name,
        dayName: day.name,
        exercises: {
          create: day.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exercise.name,
            planExerciseId: exercise.id,
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
    exerciseId: string,
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
        workoutSessionId: sessionId,
        exerciseId,
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

  async getProgressExercises(userId: string): Promise<ExerciseDTO[]> {
    const rows = await this.prisma.workoutExercise.findMany({
      where: {
        workoutSession: {
          userId,
        },
      },
      distinct: ["exerciseId"],
      include: {
        exercise: true,
      },
      orderBy: {
        exerciseId: "asc",
      },
    })

    return rows.map((row) => ({
      id: row.exercise.id,
      name: row.exercise.name,
      muscleGroup: row.exercise.muscleGroup,
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
      planId: row.workoutSession.planId,
      planDayId: row.workoutSession.planDayId,
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
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName,
          planExerciseId: row.planExerciseId ?? undefined,
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

  private async ensureUser(user: { id: string; email?: string; name?: string }) {
    const fallbackEmail = user.id === demoUser.id ? demoUser.email : `${user.id}@local.app`
    const fallbackName = user.id === demoUser.id ? demoUser.name : "Usuario"

    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? fallbackEmail,
        name: user.name ?? fallbackName,
        createdAt: new Date(demoUser.createdAt),
      },
      update: {
        email: user.email ?? fallbackEmail,
        name: user.name ?? fallbackName,
      },
    })
  }
}
