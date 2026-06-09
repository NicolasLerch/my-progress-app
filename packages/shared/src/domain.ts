export type PlanStatus = "draft" | "active" | "archived" | "completed"
export type WorkoutSessionStatus = "in_progress" | "completed" | "abandoned"

export interface UserDTO {
  id: string
  email: string
  name: string
  lastName?: string
  birthDate?: string
  weight?: number
  height?: number
  createdAt: string
}

export interface UserProfileDTO {
  user: UserDTO
  bmi?: number
}

export interface UpdateUserProfileInputDTO {
  weight?: number
  height?: number
}

export interface ExerciseDTO {
  id: string
  name: string
  muscleGroup: string
}

export interface PlanExerciseDTO {
  id: string
  planDayId: string
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps: number
  restSeconds: number
  notes?: string
}

export interface PlanDayDTO {
  id: string
  planId: string
  name: string
  order: number
  exercises: PlanExerciseDTO[]
}

export interface PlanDTO {
  id: string
  userId: string
  name: string
  startDate: string
  endDate?: string
  status: PlanStatus
  createdAt: string
  updatedAt: string
  currentDay: number
  totalDays: number
  days: PlanDayDTO[]
}

export interface WorkoutSetDTO {
  id: string
  workoutExerciseId: string
  setNumber: number
  weight: number
  reps: number
  rir?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface WorkoutExerciseDTO {
  id: string
  workoutSessionId: string
  exerciseId: string
  exerciseName: string
  planExerciseId?: string
  targetSets: number
  targetReps: number
  restSeconds: number
  notes?: string
  sets: WorkoutSetDTO[]
}

export interface WorkoutSessionDTO {
  id: string
  userId: string
  planId?: string
  planDayId?: string
  date: string
  notes?: string
  status: WorkoutSessionStatus
  startedAt: string
  completedAt?: string
  planName: string
  dayName: string
  durationMinutes?: number
  exercises: WorkoutExerciseDTO[]
}

export interface HomeStatsDTO {
  totalWorkouts: number
  currentStreak: number
  totalWeightLifted: number
}

export interface HomeTodayDTO {
  user: UserDTO
  activePlan?: PlanDTO
  todayDay?: PlanDayDTO
  currentSession?: WorkoutSessionDTO
  recentSessions: WorkoutSessionDTO[]
  stats: HomeStatsDTO
}

export interface HistoryItemDTO {
  id: string
  date: string
  planName: string
  dayName: string
  durationMinutes: number
  totalVolume: number
  exerciseCount: number
  status: WorkoutSessionStatus
}

export interface ProgressPointDTO {
  date: string
  weight: number
  reps: number
  sets: number
  volume: number
}

export interface ProgressStatsDTO {
  maxWeight: number
  maxWeightDate: string
  minWeight: number
  minWeightDate: string
  maxVolume: number
  maxVolumeDate: string
  netChange: number
  totalSessions: number
}

export interface ProgressSeriesDTO {
  exercise: ExerciseDTO
  points: ProgressPointDTO[]
  stats: ProgressStatsDTO
}

export interface WorkoutSetInputDTO {
  id?: string
  setNumber: number
  weight: number
  reps: number
  rir?: number
  notes?: string
  updatedAt: string
}

export interface CreatePlannedWorkoutSessionInputDTO {
  planId: string
  planDayId: string
  date: string
}

export interface CreatePlanlessWorkoutSessionInputDTO {
  mode: "planless"
  date: string
}

export type CreateWorkoutSessionInputDTO =
  | CreatePlannedWorkoutSessionInputDTO
  | CreatePlanlessWorkoutSessionInputDTO

export interface CreateWorkoutExerciseInputDTO {
  exerciseId: string
}

export interface CreatePlanInputDTO {
  name: string
  startDate: string
  endDate?: string
  status?: PlanStatus
  currentDay?: number
  days: Array<{
    name: string
    order: number
    exercises: Array<{
      exerciseId: string
      exerciseName: string
      targetSets: number
      targetReps: number
      restSeconds: number
      notes?: string
    }>
  }>
}
