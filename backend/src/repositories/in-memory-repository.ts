import {
  buildProgressSeries,
  calculateSessionVolume,
  createPlanInputSchema,
  demoUser,
  exercisesSeed,
  plansSeed,
  type CreatePlanInputDTO,
  type CreateWorkoutSessionInputDTO,
  type ExerciseDTO,
  type HistoryItemDTO,
  type HomeTodayDTO,
  type PlanDTO,
  type ProgressSeriesDTO,
  type WorkoutSessionDTO,
  type WorkoutSetInputDTO,
  workoutSessionsSeed,
} from "@my-progress/shared"

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export class InMemoryRepository {
  private exercises = clone(exercisesSeed)
  private plans = clone(plansSeed)
  private sessions = clone(workoutSessionsSeed)

  getExercises(): ExerciseDTO[] {
    return clone(this.exercises)
  }

  getPlans(userId: string): PlanDTO[] {
    return clone(this.plans.filter((plan) => plan.userId === userId))
  }

  getPlan(userId: string, planId: string) {
    return clone(this.plans.find((plan) => plan.userId === userId && plan.id === planId))
  }

  createPlan(userId: string, input: CreatePlanInputDTO): PlanDTO {
    const parsed = createPlanInputSchema.parse(input)
    const timestamp = new Date().toISOString()
    const planId = randomId("plan")
    const plan: PlanDTO = {
      id: planId,
      userId,
      name: parsed.name,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      status: parsed.status ?? "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
      currentDay: parsed.currentDay ?? 1,
      totalDays: parsed.days.length,
      days: parsed.days
        .sort((a, b) => a.order - b.order)
        .map((day) => {
          const dayId = randomId("day")
          return {
            id: dayId,
            planId,
            name: day.name,
            order: day.order,
            exercises: day.exercises.map((exercise) => ({
              id: randomId("plan-exercise"),
              planDayId: dayId,
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              targetSets: exercise.targetSets,
              targetReps: exercise.targetReps,
              restSeconds: exercise.restSeconds,
              notes: exercise.notes,
            })),
          }
        }),
    }

    if (plan.status === "active") {
      this.plans = this.plans.map((item) =>
        item.userId === userId && item.status === "active" ? { ...item, status: "archived" } : item,
      )
    }

    this.plans.unshift(plan)
    return clone(plan)
  }

  updatePlan(userId: string, planId: string, partial: Partial<PlanDTO>) {
    const index = this.plans.findIndex((plan) => plan.userId === userId && plan.id === planId)
    if (index === -1) {
      return null
    }

    this.plans[index] = {
      ...this.plans[index],
      ...partial,
      updatedAt: new Date().toISOString(),
    }

    return clone(this.plans[index])
  }

  activatePlan(userId: string, planId: string) {
    let activated: PlanDTO | null = null
    this.plans = this.plans.map((plan) => {
      if (plan.userId !== userId) return plan
      if (plan.id === planId) {
        activated = { ...plan, status: "active", updatedAt: new Date().toISOString() }
        return activated
      }
      if (plan.status === "active") {
        return { ...plan, status: "archived", updatedAt: new Date().toISOString() }
      }
      return plan
    })

    return activated ? clone(activated) : null
  }

  archivePlan(userId: string, planId: string) {
    return this.updatePlan(userId, planId, { status: "archived" })
  }

  getHome(userId: string): HomeTodayDTO {
    const userPlans = this.getPlans(userId)
    const activePlan = userPlans.find((plan) => plan.status === "active")
    const currentSession = clone(
      this.sessions.find((session) => session.userId === userId && session.status === "in_progress"),
    )
    const recentSessions = this.sessions
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4)
      .map((session) => clone(session))

    const totalWorkouts = this.sessions.filter((session) => session.userId === userId && session.status === "completed").length
    const totalWeightLifted = this.sessions
      .filter((session) => session.userId === userId)
      .reduce((total, session) => total + calculateSessionVolume(session), 0)

    return {
      user: demoUser,
      activePlan,
      todayDay: activePlan?.days.find((day) => day.order === activePlan.currentDay),
      currentSession,
      recentSessions,
      stats: {
        totalWorkouts,
        currentStreak: Math.min(totalWorkouts, 4),
        totalWeightLifted,
      },
    }
  }

  createWorkoutSession(userId: string, input: CreateWorkoutSessionInputDTO) {
    const plan = this.plans.find((item) => item.userId === userId && item.id === input.planId)
    const day = plan?.days.find((item) => item.id === input.planDayId)

    if (!plan || !day) {
      return null
    }

    const session: WorkoutSessionDTO = {
      id: randomId("session"),
      userId,
      planId: plan.id,
      planDayId: day.id,
      date: input.date,
      status: "in_progress",
      startedAt: input.date,
      planName: plan.name,
      dayName: day.name,
      exercises: day.exercises.map((exercise) => ({
        id: randomId("workout-exercise"),
        workoutSessionId: "",
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        planExerciseId: exercise.id,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
        sets: [],
      })),
    }

    session.exercises = session.exercises.map((exercise) => ({
      ...exercise,
      workoutSessionId: session.id,
    }))

    this.sessions.unshift(session)
    return clone(session)
  }

  getWorkoutSession(userId: string, sessionId: string) {
    return clone(this.sessions.find((session) => session.userId === userId && session.id === sessionId))
  }

  upsertWorkoutSet(userId: string, sessionId: string, exerciseId: string, payload: WorkoutSetInputDTO) {
    const session = this.sessions.find((item) => item.userId === userId && item.id === sessionId)
    const exercise = session?.exercises.find((item) => item.exerciseId === exerciseId)

    if (!session || !exercise) {
      return null
    }

    const existing = exercise.sets.find((item) => item.setNumber === payload.setNumber)
    if (existing) {
      existing.weight = payload.weight
      existing.reps = payload.reps
      existing.rir = payload.rir
      existing.notes = payload.notes
      existing.updatedAt = payload.updatedAt
    } else {
      exercise.sets.push({
        id: payload.id ?? randomId("set"),
        workoutExerciseId: exercise.id,
        setNumber: payload.setNumber,
        weight: payload.weight,
        reps: payload.reps,
        rir: payload.rir,
        notes: payload.notes,
        createdAt: payload.updatedAt,
        updatedAt: payload.updatedAt,
      })
      exercise.sets.sort((a, b) => a.setNumber - b.setNumber)
    }

    return clone(session)
  }

  updateWorkoutSession(userId: string, sessionId: string, partial: Partial<WorkoutSessionDTO>) {
    const index = this.sessions.findIndex((session) => session.userId === userId && session.id === sessionId)
    if (index === -1) {
      return null
    }

    this.sessions[index] = {
      ...this.sessions[index],
      ...partial,
    }

    return clone(this.sessions[index])
  }

  completeWorkoutSession(userId: string, sessionId: string) {
    return this.updateWorkoutSession(userId, sessionId, {
      status: "completed",
      completedAt: new Date().toISOString(),
    })
  }

  getHistory(userId: string): HistoryItemDTO[] {
    return this.sessions
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((session) => ({
        id: session.id,
        date: session.date,
        planName: session.planName,
        dayName: session.dayName,
        durationMinutes: session.durationMinutes ?? 0,
        totalVolume: calculateSessionVolume(session),
        exerciseCount: session.exercises.length,
        status: session.status,
      }))
  }

  getProgressExercises(userId: string) {
    const exerciseIds = new Set(
      this.sessions
        .filter((session) => session.userId === userId)
        .flatMap((session) => session.exercises.map((exercise) => exercise.exerciseId)),
    )

    return this.exercises.filter((exercise) => exerciseIds.has(exercise.id))
  }

  getProgressSeries(userId: string, exerciseId: string): ProgressSeriesDTO | null {
    const exercise = this.exercises.find((item) => item.id === exerciseId)
    if (!exercise) {
      return null
    }

    const sessions = this.sessions.filter((session) => session.userId === userId && session.status === "completed")
    return buildProgressSeries(exercise, sessions)
  }
}
