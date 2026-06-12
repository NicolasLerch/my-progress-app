import type {
  ExerciseDTO,
  PlanDTO,
  UserDTO,
  WorkoutSessionDTO,
} from "./domain.js"

const now = "2026-06-05T09:00:00.000Z"

export const demoUser: UserDTO = {
  id: "user-demo",
  email: "carlos@example.com",
  name: "Carlos",
  lastName: "Gomez",
  birthDate: "1997-03-12",
  weight: 82,
  height: 178,
  createdAt: "2024-01-15T00:00:00.000Z",
}

export const exercisesSeed: ExerciseDTO[] = [
  { id: "bench-press", name: "Press banca", muscleGroup: "Pecho" },
  { id: "incline-dumbbell-press", name: "Press inclinado mancuernas", muscleGroup: "Pecho" },
  { id: "cable-fly", name: "Aperturas en polea", muscleGroup: "Pecho" },
  { id: "dips", name: "Fondos en paralelas", muscleGroup: "Triceps" },
  { id: "rope-pushdown", name: "Extensiones triceps polea", muscleGroup: "Triceps" },
  { id: "pull-up", name: "Dominadas", muscleGroup: "Espalda" },
  { id: "barbell-row", name: "Remo con barra", muscleGroup: "Espalda" },
  { id: "squat", name: "Sentadilla", muscleGroup: "Piernas" },
  { id: "deadlift", name: "Peso muerto", muscleGroup: "Piernas" },
  { id: "overhead-press", name: "Press militar", muscleGroup: "Hombros" },
]

export const plansSeed: PlanDTO[] = [
  {
    id: "plan-ppl",
    userId: demoUser.id,
    name: "Push Pull Legs",
    startDate: "2026-05-01T00:00:00.000Z",
    endDate: "2026-08-31T00:00:00.000Z",
    status: "active",
    createdAt: now,
    updatedAt: now,
    currentDay: 1,
    totalDays: 3,
    days: [
      {
        id: "day-1",
        planId: "plan-ppl",
        name: "Dia 1 - Pecho y Triceps",
        order: 1,
        exercises: [
          { id: "pe-1", planDayId: "day-1", exerciseId: "bench-press", exerciseName: "Press banca", targetSets: 4, targetReps: "8", restSeconds: 90 },
          { id: "pe-2", planDayId: "day-1", exerciseId: "incline-dumbbell-press", exerciseName: "Press inclinado mancuernas", targetSets: 4, targetReps: "10", restSeconds: 75 },
          { id: "pe-3", planDayId: "day-1", exerciseId: "cable-fly", exerciseName: "Aperturas en polea", targetSets: 3, targetReps: "12", restSeconds: 60 },
          { id: "pe-4", planDayId: "day-1", exerciseId: "dips", exerciseName: "Fondos en paralelas", targetSets: 3, targetReps: "12", restSeconds: 60 },
        ],
      },
      {
        id: "day-2",
        planId: "plan-ppl",
        name: "Dia 2 - Espalda",
        order: 2,
        exercises: [
          { id: "pe-5", planDayId: "day-2", exerciseId: "pull-up", exerciseName: "Dominadas", targetSets: 4, targetReps: "8", restSeconds: 90 },
          { id: "pe-6", planDayId: "day-2", exerciseId: "barbell-row", exerciseName: "Remo con barra", targetSets: 4, targetReps: "10", restSeconds: 90 },
        ],
      },
      {
        id: "day-3",
        planId: "plan-ppl",
        name: "Dia 3 - Piernas",
        order: 3,
        exercises: [
          { id: "pe-7", planDayId: "day-3", exerciseId: "squat", exerciseName: "Sentadilla", targetSets: 4, targetReps: "6", restSeconds: 120 },
          { id: "pe-8", planDayId: "day-3", exerciseId: "deadlift", exerciseName: "Peso muerto", targetSets: 3, targetReps: "5", restSeconds: 120 },
        ],
      },
    ],
  },
]

export const workoutSessionsSeed: WorkoutSessionDTO[] = [
  {
    id: "session-1",
    userId: demoUser.id,
    planId: "plan-ppl",
    planDayId: "day-1",
    date: "2026-05-20T18:00:00.000Z",
    status: "completed",
    startedAt: "2026-05-20T18:00:00.000Z",
    completedAt: "2026-05-20T19:02:00.000Z",
    planName: "Push Pull Legs",
    dayName: "Dia 1 - Pecho y Triceps",
    durationMinutes: 62,
    exercises: [
      {
        id: "we-1",
        workoutSessionId: "session-1",
        position: 1,
        exerciseId: "bench-press",
        exerciseName: "Press banca",
        planExerciseId: "pe-1",
        isReplacement: false,
        targetSets: 4,
        targetReps: "8",
        restSeconds: 90,
        sets: [
          { id: "set-1", workoutExerciseId: "we-1", setNumber: 1, weight: 90, reps: 8, createdAt: now, updatedAt: now },
          { id: "set-2", workoutExerciseId: "we-1", setNumber: 2, weight: 92.5, reps: 8, createdAt: now, updatedAt: now },
          { id: "set-3", workoutExerciseId: "we-1", setNumber: 3, weight: 95, reps: 7, createdAt: now, updatedAt: now },
          { id: "set-4", workoutExerciseId: "we-1", setNumber: 4, weight: 95, reps: 6, createdAt: now, updatedAt: now },
        ],
      },
      {
        id: "we-2",
        workoutSessionId: "session-1",
        position: 2,
        exerciseId: "incline-dumbbell-press",
        exerciseName: "Press inclinado mancuernas",
        planExerciseId: "pe-2",
        isReplacement: false,
        targetSets: 4,
        targetReps: "10",
        restSeconds: 75,
        sets: [
          { id: "set-5", workoutExerciseId: "we-2", setNumber: 1, weight: 30, reps: 10, createdAt: now, updatedAt: now },
          { id: "set-6", workoutExerciseId: "we-2", setNumber: 2, weight: 30, reps: 10, createdAt: now, updatedAt: now },
        ],
      },
    ],
  },
  {
    id: "session-2",
    userId: demoUser.id,
    planId: "plan-ppl",
    planDayId: "day-3",
    date: "2026-05-28T18:00:00.000Z",
    status: "completed",
    startedAt: "2026-05-28T18:00:00.000Z",
    completedAt: "2026-05-28T19:12:00.000Z",
    planName: "Push Pull Legs",
    dayName: "Dia 3 - Piernas",
    durationMinutes: 72,
    exercises: [
      {
        id: "we-3",
        workoutSessionId: "session-2",
        position: 1,
        exerciseId: "squat",
        exerciseName: "Sentadilla",
        planExerciseId: "pe-7",
        isReplacement: false,
        targetSets: 4,
        targetReps: "6",
        restSeconds: 120,
        sets: [
          { id: "set-7", workoutExerciseId: "we-3", setNumber: 1, weight: 130, reps: 6, createdAt: now, updatedAt: now },
          { id: "set-8", workoutExerciseId: "we-3", setNumber: 2, weight: 132.5, reps: 6, createdAt: now, updatedAt: now },
          { id: "set-9", workoutExerciseId: "we-3", setNumber: 3, weight: 135, reps: 5, createdAt: now, updatedAt: now },
        ],
      },
      {
        id: "we-4",
        workoutSessionId: "session-2",
        position: 2,
        exerciseId: "deadlift",
        exerciseName: "Peso muerto",
        planExerciseId: "pe-8",
        isReplacement: false,
        targetSets: 3,
        targetReps: "5",
        restSeconds: 120,
        sets: [
          { id: "set-10", workoutExerciseId: "we-4", setNumber: 1, weight: 160, reps: 5, createdAt: now, updatedAt: now },
          { id: "set-11", workoutExerciseId: "we-4", setNumber: 2, weight: 165, reps: 5, createdAt: now, updatedAt: now },
        ],
      },
    ],
  },
]
