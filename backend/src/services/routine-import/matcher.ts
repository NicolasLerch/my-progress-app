import type { ExerciseDTO, ExerciseMatch } from '@my-progress/shared'
import { featureWeight, incompatible, profileExercise, type ExerciseProfile } from './exercise-vocabulary.js'
export { normalizeExerciseName } from './exercise-vocabulary.js'

function smallTypo(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]))
    previous = current
  }
  return previous[b.length] <= 1
}
function scoreProfiles(a: ExerciseProfile, b: ExerciseProfile): number {
  const features = (profile: ExerciseProfile) => new Map([
    ...profile.attributes,
    ...(profile.movement ? [['movement', profile.movement] as const] : []),
    ...(profile.family ? [['family', profile.family] as const] : []),
  ])
  const left = features(a), right = features(b)
  let total = 0, matched = 0
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const weight = featureWeight(key)
    if (left.has(key) && right.has(key)) { total += weight * 2; if (left.get(key) === right.get(key)) matched += weight * 2 }
    else { total += weight; matched += weight * 0.5 }
  }
  // Only words unclassified on BOTH sides may receive typo credit.
  const remaining = new Set(b.other)
  total += a.other.size + b.other.size
  for (const word of a.other) {
    if (remaining.delete(word)) matched += 2
    else {
      const close = [...remaining].sort().find(candidate => smallTypo(word, candidate))
      if (close) { remaining.delete(close); matched += 1.6 }
    }
  }
  return total ? matched / total : 0
}
export interface ExerciseMatcher { match(name: string): ExerciseMatch }
export class CatalogExerciseMatcher implements ExerciseMatcher {
  private readonly entries: Array<{ exercise: ExerciseDTO; profile: ExerciseProfile }>
  constructor(catalog: ExerciseDTO[]) { this.entries = catalog.map(exercise => ({ exercise, profile: profileExercise(exercise.name) })) }
  match(name: string): ExerciseMatch {
    const profile = profileExercise(name)
    if (!profile.canonical) return { status: 'unresolved', score: 0, exercise: null }
    const candidates = this.entries.filter(entry => !incompatible(profile, entry.profile)).map(entry => ({
      ...entry, exact: profile.canonical === entry.profile.canonical, score: scoreProfiles(profile, entry.profile),
    })).sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || a.exercise.id.localeCompare(b.exercise.id))
    const best = candidates[0]
    if (!best || best.score < 0.65) return { status: 'unresolved', score: best?.score ?? 0, exercise: null }
    const margin = best.score - (candidates[1]?.score ?? 0)
    const knownMovement = profile.movement !== null && profile.movement === best.profile.movement &&
      (profile.movement !== 'press' || (profile.family !== null && profile.family === best.profile.family))
    const status = best.exact && !candidates[1]?.exact ? 'high' : knownMovement && best.score >= 0.85 && margin >= 0.10 ? 'medium' : 'low'
    return { status, score: best.score, exercise: best.exercise }
  }
}
