import assert from "node:assert/strict"
import test from "node:test"
import { buildProgressSeries } from "../dist/metrics.js"

const exercise = { id: "squat", name: "Sentadilla", muscleGroup: "Piernas" }

function session(date, sets) {
  return {
    id: date,
    date,
    exercises: [{
      exerciseId: exercise.id,
      sets: sets.map(([weight, reps]) => ({ weight, reps })),
    }],
  }
}

function buildSeries(sessions) {
  return buildProgressSeries(exercise, sessions)
}

test("does not enable formal analysis before six valid sessions", () => {
  const series = buildSeries([
    session("2026-01-01", [[100, 10]]),
    session("2026-01-02", [[105, 10]]),
    session("2026-01-03", [[110, 10]]),
    session("2026-01-04", [[115, 10]]),
    session("2026-01-05", [[120, 10]]),
  ])

  assert.equal(series.analysis.sessionCount, 5)
  assert.equal(series.analysis.canAnalyzeProgress, false)
  assert.equal(series.analysis.sessionsRemaining, 1)
  assert.equal(series.analysis.pr.current, 120)
  assert.equal(series.analysis.pr.max, 120)
  assert.equal(series.analysis.pr.historical, undefined)
  assert.equal(series.analysis.overall.historical, undefined)
})

test("calculates historical and recent progress from three-session blocks", () => {
  const series = buildSeries([
    session("2026-01-01", [[100, 10]]),
    session("2026-01-02", [[100, 10]]),
    session("2026-01-03", [[100, 10]]),
    session("2026-01-04", [[100, 10]]),
    session("2026-01-05", [[110, 10]]),
    session("2026-01-06", [[120, 10]]),
  ])

  assert.equal(series.analysis.canAnalyzeProgress, true)
  assert.equal(series.analysis.pr.historical?.changePercent, 10)
  assert.equal(series.analysis.pr.recent?.changePercent, 10)
  assert.equal(series.analysis.pr.historical?.status, "positive")
  assert.equal(series.analysis.volume.historical?.changePercent, 10)
  assert.equal(series.analysis.repetitions.historical?.status, "maintenance")
  assert.equal(series.analysis.overall.historical?.score, 8)
  assert.equal(series.analysis.overall.historical?.status, "positive")
})

test("uses the immediately preceding block for the recent trend", () => {
  const series = buildSeries([
    session("2026-01-01", [[100, 10]]),
    session("2026-01-02", [[100, 10]]),
    session("2026-01-03", [[100, 10]]),
    session("2026-01-04", [[110, 10]]),
    session("2026-01-05", [[110, 10]]),
    session("2026-01-06", [[110, 10]]),
    session("2026-01-07", [[120, 10]]),
    session("2026-01-08", [[120, 10]]),
    session("2026-01-09", [[120, 10]]),
  ])

  assert.equal(series.analysis.pr.historical?.changePercent, 20)
  assert.ok(Math.abs((series.analysis.pr.recent?.changePercent ?? 0) - 9.090909090909092) < Number.EPSILON)
})

test("classifies an exact five percent change as maintenance", () => {
  const series = buildSeries([
    session("2026-01-01", [[100, 10]]),
    session("2026-01-02", [[100, 10]]),
    session("2026-01-03", [[100, 10]]),
    session("2026-01-04", [[105, 10]]),
    session("2026-01-05", [[105, 10]]),
    session("2026-01-06", [[105, 10]]),
  ])

  assert.equal(series.analysis.pr.historical?.changePercent, 5)
  assert.equal(series.analysis.pr.historical?.status, "maintenance")
  assert.equal(series.analysis.volume.historical?.status, "maintenance")
})

test("sorts points, ignores empty sessions, and keeps decimal maximums", () => {
  const series = buildSeries([
    session("2026-01-03", [[42.5, 8]]),
    session("2026-01-01", [[40.25, 10]]),
    session("2026-01-02", []),
  ])

  assert.deepEqual(series.points.map((point) => point.date), ["2026-01-01", "2026-01-03"])
  assert.equal(series.analysis.sessionCount, 2)
  assert.equal(series.analysis.pr.max, 42.5)
  assert.equal(series.analysis.pr.maxDate, "2026-01-03")
  assert.equal(series.analysis.volume.max, 402.5)
})

test("does not produce percentages or overall analysis when a baseline is zero", () => {
  const sessions = Array.from({ length: 6 }, (_, index) =>
    session(`2026-01-0${index + 1}`, [[0, 10 + index]]),
  )
  const series = buildSeries(sessions)

  assert.equal(series.analysis.canAnalyzeProgress, true)
  assert.equal(series.analysis.pr.historical, undefined)
  assert.equal(series.analysis.volume.historical, undefined)
  assert.equal(series.analysis.repetitions.historical?.status, "positive")
  assert.equal(series.analysis.overall.historical, undefined)
  assert.equal(Number.isFinite(series.analysis.repetitions.historical?.changePercent ?? NaN), true)
})
