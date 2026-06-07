import type {
  CreatePlanInputDTO,
  CreateWorkoutExerciseInputDTO,
  CreateWorkoutSessionInputDTO,
  ExerciseDTO,
  HistoryItemDTO,
  HomeTodayDTO,
  PlanDTO,
  ProgressSeriesDTO,
  WorkoutSessionDTO,
  WorkoutSetInputDTO,
} from "@my-progress/shared"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message ?? `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  getHome: () => request<HomeTodayDTO>("/home/today"),
  getExercises: () => request<ExerciseDTO[]>("/exercises"),
  getPlans: () => request<PlanDTO[]>("/plans"),
  getPlan: (planId: string) => request<PlanDTO>(`/plans/${planId}`),
  createPlan: (input: CreatePlanInputDTO) =>
    request<PlanDTO>("/plans", { method: "POST", body: JSON.stringify(input) }),
  updatePlan: (planId: string, input: Partial<PlanDTO>) =>
    request<PlanDTO>(`/plans/${planId}`, { method: "PUT", body: JSON.stringify(input) }),
  activatePlan: (planId: string) =>
    request<PlanDTO>(`/plans/${planId}/activate`, { method: "POST" }),
  deletePlan: (planId: string) =>
    request<void>(`/plans/${planId}`, { method: "DELETE" }),
  createWorkoutSession: (input: CreateWorkoutSessionInputDTO) =>
    request<WorkoutSessionDTO>("/workout-sessions", { method: "POST", body: JSON.stringify(input) }),
  getWorkoutSession: (sessionId: string) => request<WorkoutSessionDTO>(`/workout-sessions/${sessionId}`),
  addWorkoutExercise: (sessionId: string, input: CreateWorkoutExerciseInputDTO) =>
    request<WorkoutSessionDTO>(`/workout-sessions/${sessionId}/exercises`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateWorkoutSession: (sessionId: string, input: Partial<WorkoutSessionDTO>) =>
    request<WorkoutSessionDTO>(`/workout-sessions/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  upsertWorkoutSet: (sessionId: string, exerciseId: string, input: WorkoutSetInputDTO) =>
    request<WorkoutSessionDTO>(`/workout-sessions/${sessionId}/exercises/${exerciseId}/sets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  completeWorkoutSession: (sessionId: string) =>
    request<WorkoutSessionDTO>(`/workout-sessions/${sessionId}/complete`, { method: "POST" }),
  getHistory: () => request<HistoryItemDTO[]>("/history"),
  getHistorySession: (sessionId: string) => request<WorkoutSessionDTO>(`/history/${sessionId}`),
  getProgressExercises: () => request<ExerciseDTO[]>("/progress/exercises"),
  getProgressSeries: (exerciseId: string) =>
    request<ProgressSeriesDTO>(`/progress/exercises/${exerciseId}`),
}
