import type { ExerciseDTO, ProgressSeriesDTO, WorkoutSessionDTO } from "./domain.js"

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
  const points = sessions
    .flatMap((session) =>
      session.exercises
        .filter((item) => item.exerciseId === exercise.id)
        .map((item) => {
          const maxWeight = item.sets.reduce((max, current) => Math.max(max, current.weight), 0)
          const totalReps = item.sets.reduce((total, current) => total + current.reps, 0)
          const volume = item.sets.reduce((total, current) => total + current.weight * current.reps, 0)

          return {
            date: session.date,
            weight: maxWeight,
            reps: totalReps,
            sets: item.sets.length,
            volume,
          }
        }),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  if (points.length === 0) {
    return {
      exercise,
      points,
      stats: {
        maxWeight: 0,
        maxWeightDate: "",
        minWeight: 0,
        minWeightDate: "",
        maxVolume: 0,
        maxVolumeDate: "",
        netChange: 0,
        totalSessions: 0,
      },
    }
  }

  const maxPoint = points.reduce((best, point) => (point.weight > best.weight ? point : best), points[0])
  const minPoint = points.reduce((best, point) => (point.weight < best.weight ? point : best), points[0])
  const maxVolumePoint = points.reduce((best, point) => (point.volume > best.volume ? point : best), points[0])

  return {
    exercise,
    points,
    stats: {
      maxWeight: maxPoint.weight,
      maxWeightDate: maxPoint.date,
      minWeight: minPoint.weight,
      minWeightDate: minPoint.date,
      maxVolume: maxVolumePoint.volume,
      maxVolumeDate: maxVolumePoint.date,
      netChange: points[points.length - 1].weight - points[0].weight,
      totalSessions: points.length,
    },
  }
}
