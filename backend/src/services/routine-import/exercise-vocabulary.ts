// Explicit vocabulary: never stem inclinado/declinado into the same token.
const connectors = new Set(['con', 'de', 'del', 'en', 'el', 'la', 'los', 'las', 'un', 'una', 'al', 'a'])
const singulars: Record<string, string> = {
  mancuernas: 'mancuerna', barras: 'barra', poleas: 'polea', maquinas: 'maquina',
  piernas: 'pierna', brazos: 'brazo', hombros: 'hombro', aperturas: 'apertura',
  elevaciones: 'elevacion', extensiones: 'extension', flexiones: 'flexion',
  dominadas: 'dominada', sentadillas: 'sentadilla', fondos: 'fondo',
  inclinada: 'inclinado', declinada: 'declinado', plana: 'plano',
  cerrada: 'cerrado', abierta: 'abierto', neutra: 'neutro',
  sogas: 'soga', cuerdas: 'cuerda',
}
const synonyms: Record<string, string> = { soga: 'cuerda' }
const aliases: Record<string, string> = {
  'bench press': 'press banca', 'barbell bench press': 'press banca barra',
  'dumbbell incline press': 'press inclinado mancuerna',
  'incline dumbbell press': 'press inclinado mancuerna', 'french press': 'press frances',
}
function lookup(table: Record<string, string>, key: string): string | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}
export function normalizeExerciseName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/)
    .filter(word => word && !connectors.has(word))
    .map(word => lookup(singulars, word) ?? word)
    .map(word => lookup(synonyms, word) ?? word).join(' ')
}
export type ExerciseProfile = {
  canonical: string
  movement: string | null
  family: string | null
  attributes: Map<string, string>
  other: Set<string>
}
const movements = new Set(['press', 'remo', 'curl', 'sentadilla', 'dominada', 'jalon', 'apertura', 'elevacion', 'extension', 'flexion', 'fondo', 'prensa'])
const attributes: Record<string, string> = {
  inclinado: 'inclinacion', declinado: 'inclinacion', plano: 'inclinacion',
  barra: 'equipo', mancuerna: 'equipo', polea: 'equipo', maquina: 'equipo', smith: 'equipo',
  cerrado: 'ancho', abierto: 'ancho', neutro: 'agarre', prono: 'agarre', supino: 'agarre',
  unilateral: 'lateralidad', bilateral: 'lateralidad', alternado: 'ejecucion', simultaneo: 'ejecucion',
  sentado: 'posicion', acostado: 'posicion',
  biceps: 'objetivo', triceps: 'objetivo', cuadriceps: 'objetivo', femoral: 'objetivo', gemelo: 'objetivo',
  lateral: 'direccion', frontal: 'direccion', posterior: 'direccion',
}
export function profileExercise(name: string): ExerciseProfile {
  const normalized = normalizeExerciseName(name)
  const canonical = lookup(aliases, normalized) ?? normalized
  const words = new Set(canonical.split(' ').filter(Boolean))
  const movement = [...words].find(word => movements.has(word)) ?? null
  let family: string | null = null
  const consumed = new Set<string>()
  if (movement) consumed.add(movement)
  if (movement === 'press') {
    if (words.has('frances')) { family = 'frances'; consumed.add('frances') }
    else if (words.has('militar') || words.has('hombro') || words.has('arnold')) {
      family = 'hombro'
      for (const word of ['militar', 'hombro']) consumed.add(word)
    } else if (['banca', 'pecho', 'inclinado', 'declinado', 'plano'].some(word => words.has(word))) {
      family = 'pecho'; consumed.add('banca'); consumed.add('pecho')
    }
  }
  const found = new Map<string, string>()
  for (const word of words) {
    const key = lookup(attributes, word)
    if (key) {
      found.set(key, [found.get(key), word].filter(Boolean).sort().join('|'))
      consumed.add(word)
    }
  }
  return { canonical, movement, family, attributes: found, other: new Set([...words].filter(word => !consumed.has(word))) }
}
export function incompatible(a: ExerciseProfile, b: ExerciseProfile): boolean {
  if (a.movement && b.movement && a.movement !== b.movement) return true
  if (a.family && b.family && a.family !== b.family) return true
  for (const [key, value] of a.attributes) {
    if (b.attributes.has(key) && b.attributes.get(key) !== value) return true
  }
  return false
}
export function featureWeight(key: string): number {
  return key === 'movement' || key === 'family' ? 4 : key === 'equipo' ? 2 : 3
}
