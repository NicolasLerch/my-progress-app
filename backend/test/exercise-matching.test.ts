import assert from 'node:assert/strict'
import test from 'node:test'
import { CatalogExerciseMatcher } from '../src/services/routine-import/matcher.js'
import { profileExercise } from '../src/services/routine-import/exercise-vocabulary.js'

const matcher = (...names: string[]) => new CatalogExerciseMatcher(names.map((name, index) => ({ id: String(index), name, muscleGroup: '' })))
test('soga and cuerda are equivalent in either direction, including plurals', () => {
  for (const word of ['soga', 'sogas', 'cuerda', 'cuerdas']) {
    assert.equal(matcher('Extensión de tríceps en polea con cuerda').match(`Extension triceps polea ${word}`).status, 'high')
    assert.equal(matcher('Extensión de tríceps en polea con soga').match(`Extension triceps polea ${word}`).status, 'high')
  }
  assert.equal(matcher('Curl biceps polea cuerda').match('Extension triceps polea soga').status, 'unresolved')
})
for (const [source, candidate] of [
  ['Press banca con barra', 'Press francés con barra'],
  ['Press inclinado con mancuernas', 'Press declinado con mancuernas'],
  ['Press banca con barra', 'Press banca con mancuernas'],
  ['Press plano con barra', 'Press inclinado con barra'],
  ['Press militar con barra', 'Press banca con barra'],
  ['Remo con agarre prono', 'Remo con agarre supino'],
  ['Curl unilateral', 'Curl bilateral'],
  ['Extension de triceps', 'Extension de cuadriceps'],
]) test(`reject incompatible candidate even alone: ${source} / ${candidate}`, () => {
  const result = matcher(candidate).match(source)
  assert.equal(result.status, 'unresolved')
  assert.equal(result.exercise, null)
})
test('real examples pick compatible candidates despite more text overlap with wrong variants', () => {
  const catalog = matcher('Press francés con barra', 'Press banca', 'Press declinado con mancuernas', 'Press inclinado mancuernas')
  const bench = catalog.match('Press banca con barra')
  assert.equal(bench.exercise?.name, 'Press banca')
  assert.equal(bench.status, 'medium')
  assert.ok(bench.score >= 0.85)
  const incline = catalog.match('Press inclinado con mancuernas')
  assert.equal(incline.exercise?.name, 'Press inclinado mancuernas')
  assert.equal(incline.status, 'high')
})
test('normalization, singular/plural, word order and complete aliases', () => {
  assert.equal(matcher('Press inclinado mancuerna').match(' PRESS, INCLINADO con MANCUERNAS! ').status, 'high')
  assert.equal(matcher('Press inclinado mancuerna').match('Mancuernas press inclinado').status, 'medium')
  assert.equal(matcher('Press banca con barra').match('Barbell bench press').status, 'high')
  assert.equal(matcher('Press frances').match('French press').status, 'high')
  assert.equal(matcher('Press frances').match('Press francés').status, 'high')
})
test('missing attributes are unknown, not implicitly flat or barbell', () => {
  const profile = profileExercise('Press banca')
  assert.equal(profile.attributes.has('inclinacion'), false)
  assert.equal(profile.attributes.has('equipo'), false)
  assert.equal(matcher('Press banca').match('Press banca con barra').status, 'medium')
  assert.equal(matcher('Press banca con barra').match('Press banca').status, 'medium')
})
test('generic names and ties retain low confidence', () => {
  assert.equal(matcher('Press banca con barra', 'Press militar con barra').match('Press con barra').status, 'low')
  assert.equal(matcher('Press banca con barra', 'Press banca con mancuernas').match('Press banca').status, 'low')
  assert.equal(matcher('Press banca', 'Press banca').match('Press banca').status, 'low')
  assert.equal(matcher('Press banca').match('!!!').status, 'unresolved')
})
test('small typo credit only applies to unclassified words', () => {
  assert.equal(matcher('Remo Pendlay').match('Remo Pendlai').status, 'medium')
  assert.equal(matcher('Press declinado mancuernas').match('Press inclinado mancuernas').status, 'unresolved')
  assert.notEqual(matcher('Press banca').match('Pres banca').status, 'high')
})
test('untrusted names cannot access inherited vocabulary properties', () => {
  for (const name of ['constructor', 'toString', '__proto__']) {
    assert.equal(matcher('Press banca').match(name).status, 'unresolved')
  }
})
