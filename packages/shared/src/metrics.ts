import type {
  ExerciseDTO,
  OverallProgressAnalysisDTO,
  ProgressAnalysisDTO,
  ProgressChangeDTO,
  ProgressMetricAnalysisDTO,
  ProgressPointDTO,
  ProgressSeriesDTO,
  ProgressStatus,
  WorkoutSessionDTO,
} from "./domain.js"

export const PROGRESS_MIN_SESSIONS = 6
export const PROGRESS_BLOCK_SIZE = 3
export const PROGRESS_THRESHOLD = 5
export const PROGRESS_WEIGHTS = {
  pr: 0.4,
  volume: 0.4,
  repetitions: 0.2,
} as const

type ProgressMetricKey = "weight" | "volume" | "reps"
type IndexedProgressPoint = ProgressPointDTO & { timestamp: number; sequence: number }

export function calculateSessionVolume(session: WorkoutSessionDTO): number {
  return session.exercises.reduce((sessionTotal, exercise) => {
    const exerciseVolume = exercise.sets.reduce((total, set) => total + set.weight * set.reps, 0)
    return sessionTotal + exerciseVolume
  }, 0)
}

export function buildProgressSeries(
  exercise: ExerciseDTO,
  sessions: WorkoutSessionDTO[],
): ProgressSeriesDTO {
  const points = buildProgressPoints(exercise.id, sessions)
  const stats = buildLegacyStats(points)

  return {
    exercise,
    points: points.map(({ timestamp: _timestamp, sequence: _sequence, ...point }) => point),
    stats,
    analysis: buildProgressAnalysis(points),
  }
}

function buildProgressPoints(exerciseId: string, sessions: WorkoutSessionDTO[]): IndexedProgressPoint[] {
  return sessions
    .flatMap((session, sequence) => {
      const timestamp = Date.parse(session.date)
      if (!Number.isFinite(timestamp)) return []

      return session.exercises
        .filter((item) => item.exerciseId === exerciseId)
        .flatMap((item) => {
          // A session is valid when it includes at least one completed repetition.
          const completedSets = item.sets.filter((set) => isPositiveFiniteNumber(set.reps))
          if (completedSets.length === 0) return []

          const weightFor = (weight: number) => isNonNegativeFiniteNumber(weight) ? weight : 0
          return [{
            date: session.date,
            weight: completedSets.reduce((max, set) => Math.max(max, weightFor(set.weight)), 0),
            reps: completedSets.reduce((total, set) => total + set.reps, 0),
            sets: completedSets.length,
            volume: completedSets.reduce((total, set) => total + weightFor(set.weight) * set.reps, 0),
            timestamp,
            sequence,
          }]
        })
    })
    .sort((a, b) => a.timestamp - b.timestamp || a.sequence - b.sequence)
}

function buildLegacyStats(points: IndexedProgressPoint[]): ProgressSeriesDTO["stats"] {
  if (points.length === 0) {
    return {
      maxWeight: 0,
      maxWeightDate: "",
      minWeight: 0,
      minWeightDate: "",
      maxVolume: 0,
      maxVolumeDate: "",
      netChange: 0,
      totalSessions: 0,
    }
  }

  const maxWeightPoint = findMaxPoint(points, "weight")
  const minWeightPoint = points.reduce((best, point) => (point.weight < best.weight ? point : best), points[0])
  const maxVolumePoint = findMaxPoint(points, "volume")

  return {
    maxWeight: maxWeightPoint.weight,
    maxWeightDate: maxWeightPoint.date,
    minWeight: minWeightPoint.weight,
    minWeightDate: minWeightPoint.date,
    maxVolume: maxVolumePoint.volume,
    maxVolumeDate: maxVolumePoint.date,
    netChange: points[points.length - 1].weight - points[0].weight,
    totalSessions: points.length,
  }
}

function buildProgressAnalysis(points: IndexedProgressPoint[]): ProgressAnalysisDTO {
  const sessionCount = points.length
  const canAnalyzeProgress = sessionCount >= PROGRESS_MIN_SESSIONS
  const sessionsRemaining = Math.max(PROGRESS_MIN_SESSIONS - sessionCount, 0)
  const pr = buildMetricAnalysis(points, "weight", canAnalyzeProgress)
  const volume = buildMetricAnalysis(points, "volume", canAnalyzeProgress)
  const repetitions = buildMetricAnalysis(points, "reps", canAnalyzeProgress)

  return {
    sessionCount,
    canAnalyzeProgress,
    sessionsRequired: PROGRESS_MIN_SESSIONS,
    sessionsRemaining,
    pr,
    volume,
    repetitions,
    overall: {
      historical: buildOverallAnalysis(pr.historical, volume.historical, repetitions.historical),
      recent: buildOverallAnalysis(pr.recent, volume.recent, repetitions.recent),
    },
  }
}

function buildMetricAnalysis(
  points: IndexedProgressPoint[],
  metric: ProgressMetricKey,
  canAnalyzeProgress: boolean,
): ProgressMetricAnalysisDTO {
  if (points.length === 0) {
    return { current: 0, max: 0, maxDate: "" }
  }

  const maxPoint = findMaxPoint(points, metric)
  const analysis: ProgressMetricAnalysisDTO = {
    current: points[points.length - 1][metric],
    max: maxPoint[metric],
    maxDate: maxPoint.date,
  }

  if (!canAnalyzeProgress) {
    return analysis
  }

  const firstBlock = points.slice(0, PROGRESS_BLOCK_SIZE)
  const lastBlock = points.slice(-PROGRESS_BLOCK_SIZE)
  const previousBlock = points.slice(-PROGRESS_BLOCK_SIZE * 2, -PROGRESS_BLOCK_SIZE)

  const historicalChange = calculateChangePercent(average(firstBlock, metric), average(lastBlock, metric))
  const recentChange = calculateChangePercent(average(previousBlock, metric), average(lastBlock, metric))

  if (historicalChange !== undefined) {
    analysis.historical = createProgressChange(historicalChange)
  }
  if (recentChange !== undefined) {
    analysis.recent = createProgressChange(recentChange)
  }

  return analysis
}

function buildOverallAnalysis(
  pr?: ProgressChangeDTO,
  volume?: ProgressChangeDTO,
  repetitions?: ProgressChangeDTO,
): OverallProgressAnalysisDTO | undefined {
  if (!pr || !volume || !repetitions) {
    return undefined
  }

  const score =
    pr.changePercent * PROGRESS_WEIGHTS.pr +
    volume.changePercent * PROGRESS_WEIGHTS.volume +
    repetitions.changePercent * PROGRESS_WEIGHTS.repetitions

  return {
    score,
    status: classifyProgress(score),
  }
}

function average(points: IndexedProgressPoint[], metric: ProgressMetricKey): number {
  if (points.length === 0) return 0
  return points.reduce((total, point) => total + point[metric], 0) / points.length
}

function calculateChangePercent(baseline: number, current: number): number | undefined {
  if (!isPositiveFiniteNumber(baseline) || !Number.isFinite(current)) {
    return undefined
  }

  return ((current - baseline) / baseline) * 100
}

function createProgressChange(changePercent: number): ProgressChangeDTO {
  return {
    changePercent,
    status: classifyProgress(changePercent),
  }
}

function classifyProgress(changePercent: number): ProgressStatus {
  if (changePercent > PROGRESS_THRESHOLD) return "positive"
  if (changePercent < -PROGRESS_THRESHOLD) return "negative"
  return "maintenance"
}

function findMaxPoint(points: IndexedProgressPoint[], metric: ProgressMetricKey): IndexedProgressPoint {
  return points.reduce((best, point) => (point[metric] > best[metric] ? point : best), points[0])
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}
