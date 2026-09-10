import { pdf } from './pdf-fixture.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import { zodTextFormat } from 'openai/helpers/zod'
import * as XLSX from 'xlsx'
import { importedRoutineSchema, type ImportedExercise } from '@my-progress/shared'
import { ExcelExtractor, PdfExtractor, validateUpload, checkedContent } from '../src/services/routine-import/extractors.js'
import { extractInWorker } from '../src/services/routine-import/extraction-worker.js'
import { OpenAIRoutineInterpreter } from '../src/services/routine-import/interpreter.js'
import { CatalogExerciseMatcher, normalizeExerciseName } from '../src/services/routine-import/matcher.js'
import { FileImportService, matchRoutine } from '../src/services/routine-import/service.js'
import { registerRoutineImport } from '../src/services/routine-import/routes.js'
import { IMPORT_LIMITS, RoutineImportError } from '../src/services/routine-import/errors.js'

const exercise: ImportedExercise = { originalName: 'Press banca', sets: 4, reps: { min: 8, max: 12, text: '8-12' }, weight: null, weightUnit: null, restSeconds: 90, notes: null, supersetGroupId: null }
const routine = { name: 'Rutina', days: [{ name: 'Pecho', exercises: [exercise] }] }
const catalog = [{ id: 'banca', name: 'Press banca', muscleGroup: 'Pecho' }, { id: 'remo', name: 'Remo con barra', muscleGroup: 'Espalda' }]
test('the installed OpenAI SDK can convert the real schema to strict Structured Outputs', () => {
  const format = zodTextFormat(importedRoutineSchema, 'imported_routine')
  assert.equal(format.type, 'json_schema')
  assert.equal(format.strict, true)
  assert.equal(format.schema.additionalProperties, false)
})
function workbook(bookType: 'xls' | 'xlsx' = 'xlsx'): Buffer {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([['LUNES'], [], ['Ejercicio', 'Series', 'Reps'], ['Press banca', 4, '8-12']])
  sheet.A4.c = [{ a: 'Coach', t: 'Controlado' }]
  sheet['!merges'] = [XLSX.utils.decode_range('A1:C1')]
  XLSX.utils.book_append_sheet(book, sheet, 'Pecho')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['', 'Martes'], ['Ejercicio', 'Remo con barra'], ['Series', 4], ['Reps', 10]]), 'Espalda')
  return XLSX.write(book, { type: 'buffer', bookType, compression: true }) as Buffer
}
for (const format of ['xlsx', 'xls'] as const) test(`Excel ${format}: tables, sheets, blank rows, comments, merges and transposed layout`, async () => {
  const data = workbook(format)
  assert.equal(validateUpload(data, `rutina.${format}`, 'application/octet-stream'), format)
  const result = await new ExcelExtractor(format).extract(data)
  assert.equal(result.blocks.length, 2)
  const first = result.blocks[0]
  assert.equal(first.kind, 'table')
  if (first.kind !== 'table') return
  assert.deepEqual(first.rows.map(row => row.row), [1, 3, 4])
  assert.equal(first.rows[2].cells[0].comment, 'Controlado')
  assert.equal(first.rows[2].cells[2].text, '8-12')
  assert.deepEqual(first.merges, ['A1:C1'])
  const second = result.blocks[1]
  assert.equal(second.kind, 'table')
  if (second.kind === 'table') assert.equal(second.rows[2].cells[1].text, '4')
})
test('bounded extraction worker runs in development', async () => {
  assert.equal((await extractInWorker(workbook(), 'xlsx')).blocks.length, 2)
})
test('PDF uses the real bounded worker: digital, scanned and corrupt', async () => {
  assert.match(JSON.stringify(await extractInWorker(pdf('DIA 1 PRESS BANCA 4x10'), 'pdf')), /PRESS BANCA/)
  await assert.rejects(extractInWorker(pdf(''), 'pdf'), { code: 'SCANNED_PDF' })
  await assert.rejects(extractInWorker(Buffer.from('%PDF-broken'), 'pdf'), { code: 'INVALID_PDF' })
})
test('PDF endpoint invokes real extraction before mocked interpretation', async () => {
  const app = Fastify()
  let interpretations = 0
  await registerRoutineImport(app, new FileImportService(async () => catalog, {
    interpretRoutine: async content => {
      interpretations++
      assert.match(JSON.stringify(content), /PRESS BANCA/)
      return routine
    },
  }))
  try {
    for (const [data, status, code] of [[pdf('PRESS BANCA 4x10'), 200, undefined], [pdf(''), 422, 'SCANNED_PDF'], [Buffer.from('%PDF-broken'), 422, 'INVALID_PDF']] as const) {
      const response = await app.inject({ method: 'POST', url: '/plans/import', headers: { 'content-type': 'multipart/form-data; boundary=pdf-test' }, payload: Buffer.concat([
        Buffer.from('--pdf-test\r\nContent-Disposition: form-data; name="file"; filename="routine.pdf"\r\nContent-Type: application/pdf\r\n\r\n'), data, Buffer.from('\r\n--pdf-test--\r\n'),
      ]) })
      assert.equal(response.statusCode, status, response.body)
      if (code) assert.equal(response.json().code, code)
    }
    assert.equal(interpretations, 1)
  } finally { await app.close() }
})
test('PDF extracts digital text; scanned and corrupt PDFs are controlled errors', async () => {
  const parser = new PdfExtractor()
  const result = await parser.extract(pdf('DIA 1 PRESS BANCA 4x10'))
  assert.equal(result.blocks[0].kind, 'text')
  assert.match(JSON.stringify(result), /PRESS BANCA 4x10/)
  await assert.rejects(parser.extract(pdf('')), { code: 'SCANNED_PDF' })
  await assert.rejects(parser.extract(Buffer.from('%PDF-broken')), { code: 'INVALID_PDF' })
})
test('upload validation rejects empty, false MIME/signature, unsupported and oversized files', () => {
  assert.throws(() => validateUpload(Buffer.alloc(0), 'x.xls', ''), { code: 'EMPTY_FILE' })
  assert.throws(() => validateUpload(Buffer.from('x'), 'x.xlsx', ''), { code: 'INVALID_FILE' })
  assert.throws(() => validateUpload(workbook(), 'x.xlsx', 'application/pdf'), { code: 'INVALID_MIME' })
  assert.throws(() => validateUpload(Buffer.from('x'), 'x.png', 'image/png'), { code: 'UNSUPPORTED_FORMAT' })
  assert.throws(() => validateUpload(Buffer.alloc(IMPORT_LIMITS.bytes + 1), 'x.pdf', ''), { code: 'FILE_TOO_LARGE' })
  assert.throws(() => checkedContent({ blocks: [{ kind: 'text', source: '1', text: 'a'.repeat(60000) }] }), { code: 'CONTENT_TOO_LARGE' })
})
test('corrupt and oversized expanded Excel are rejected', async () => {
  await assert.rejects(new ExcelExtractor('xlsx').extract(Buffer.from('PK broken')), { code: 'INVALID_EXCEL' })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['a'.repeat(20000)]]), 'Test')
  const data = XLSX.write(book, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer
  const directory = data.indexOf(Buffer.from('504b0102', 'hex'))
  data.writeUInt32LE(IMPORT_LIMITS.expandedBytes + 1, directory + 24)
  await assert.rejects(new ExcelExtractor('xlsx').extract(data), { code: 'CONTENT_TOO_LARGE' })
})
test('interpreter passes extracted 4x10 and preserves structured ranges without defaults', async () => {
  const interpreter = new OpenAIRoutineInterpreter(async input => {
    assert.match(JSON.stringify(input.content), /4x10/)
    assert.match(input.prompt, /null/)
    return { status: 'completed', output: routine }
  })
  const result = await interpreter.interpretRoutine({ blocks: [{ kind: 'text', source: '1', text: 'Press banca 4x10' }] })
  assert.deepEqual(result, routine)
  assert.equal(result.days[0].exercises[0].weight, null)
  assert.equal(result.days[0].exercises[0].reps?.text, '8-12')
  const fourTen = { ...routine, days: [{ name: null, exercises: [{ ...exercise, reps: { min: 10, max: 10, text: '10' }, restSeconds: null }] }] }
  assert.deepEqual(await new OpenAIRoutineInterpreter(async () => ({ status: 'completed', output: fourTen })).interpretRoutine({ blocks: [] }), fourTen)
})
test('AI invalid JSON/schema, refusals, empty results and provider timeout are rejected', async () => {
  for (const [output, status, code] of [[{ name: 4 }, 'completed', 'AI_INVALID_RESPONSE'], [null, 'completed', 'AI_INCOMPLETE'], [routine, 'incomplete', 'AI_INCOMPLETE'], [{ name: null, days: [] }, 'completed', 'NO_ROUTINE'], [{ name: null, days: [{ name: null, exercises: [] }] }, 'completed', 'NO_EXERCISES']] as const) {
    const interpreter = new OpenAIRoutineInterpreter(async () => ({ status, output }))
    await assert.rejects(interpreter.interpretRoutine({ blocks: [] }), { code })
  }
  await assert.rejects(new OpenAIRoutineInterpreter(async () => { throw new SyntaxError('bad JSON') }).interpretRoutine({ blocks: [] }), { code: 'AI_INVALID_RESPONSE' })
  await assert.rejects(new OpenAIRoutineInterpreter(async () => { throw new Error('timeout') }).interpretRoutine({ blocks: [] }), { code: 'AI_PROVIDER_ERROR' })
  assert.equal(importedRoutineSchema.safeParse({ ...routine, days: [{ name: null, exercises: [{ ...exercise, sets: -1 }] }] }).success, false)
})
test('missing OpenAI key is a controlled error without a network request', async () => {
  const key = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    await assert.rejects(new OpenAIRoutineInterpreter().interpretRoutine({ blocks: [] }), { code: 'IMPORT_NOT_CONFIGURED', statusCode: 503 })
  } finally {
    if (key !== undefined) process.env.OPENAI_API_KEY = key
  }
})
test('matching exact, approximate, ambiguous and unresolved names', () => {
  assert.equal(normalizeExerciseName('  EXTENSIÓN, de TRÍCEPS! '), 'extension triceps')
  const matcher = new CatalogExerciseMatcher(catalog)
  assert.equal(matcher.match('PRESS BÁNCA').status, 'high')
  assert.equal(matcher.match('Press banca con barra').status, 'medium')
  assert.equal(matcher.match('prensa').status, 'unresolved')
  assert.equal(new CatalogExerciseMatcher([...catalog, { ...catalog[0], id: 'duplicate' }]).match('press banca').status, 'low')
  assert.equal(matcher.match('!!!').status, 'unresolved')
})
test('matching preserves compatible supersets and annotates incompatible groups', () => {
  const grouped = { name: null, days: [{ name: null, exercises: [{ ...exercise, supersetGroupId: 'A' }, { ...exercise, supersetGroupId: 'A' }] }] }
  const result = matchRoutine(grouped, catalog)
  assert.equal(result.warnings.length, 0)
  assert.equal(result.routine.days[0].exercises[0].supersetGroupId, 'A')
  grouped.days[0].exercises[1].restSeconds = null
  const invalid = matchRoutine(grouped, catalog)
  assert.equal(invalid.warnings.length, 1)
  assert.equal(invalid.routine.days[0].exercises[0].supersetGroupId, null)
  assert.match(invalid.routine.days[0].exercises[0].notes ?? '', /Agrupación/)
})
test('import service extracts and interprets before loading catalog, without persistence', async () => {
  const calls: string[] = []
  const service = new FileImportService(async () => { calls.push('catalog'); return catalog }, { interpretRoutine: async () => { calls.push('interpret'); return routine } }, async () => { calls.push('extract'); return { blocks: [] } })
  assert.equal((await service.importFile(workbook(), 'routine.xlsx', '')).routine.days[0].exercises[0].match.status, 'high')
  assert.deepEqual(calls, ['extract', 'interpret', 'catalog'])
})
test('HTTP upload authenticates, returns preview and sanitizes failures', async () => {
  const app = Fastify()
  let calls = 0
  app.addHook('preHandler', async (request, reply) => { if (request.headers.authorization !== 'Bearer test') return reply.code(401).send({ message: 'Unauthorized' }) })
  await registerRoutineImport(app, { importFile: async () => { calls++; return matchRoutine(routine, catalog) } })
  const boundary = 'routine-boundary'
  const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="routine.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`), workbook(), Buffer.from(`\r\n--${boundary}--\r\n`)])
  const request = { method: 'POST' as const, url: '/plans/import', headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload }
  try {
    assert.equal((await app.inject(request)).statusCode, 401)
    assert.equal(calls, 0)
    const response = await app.inject({ ...request, headers: { ...request.headers, authorization: 'Bearer test' } })
    assert.equal(response.statusCode, 200, response.body)
    assert.equal(response.json().routine.name, 'Rutina')
    assert.equal(calls, 1)
    const invalid = await app.inject({ method: 'POST', url: '/plans/import', headers: { authorization: 'Bearer test' }, payload: {} })
    assert.equal(invalid.statusCode, 400)
    assert.equal(invalid.json().code, 'INVALID_UPLOAD')
  } finally { await app.close() }
})
test('HTTP failures do not expose internal messages', async () => {
  const app = Fastify()
  await registerRoutineImport(app, { importFile: async () => { throw new Error('secret internal stack') } })
  try {
    const response = await app.inject({ method: 'POST', url: '/plans/import', headers: { 'content-type': 'multipart/form-data; boundary=x' }, payload: '--x\r\nContent-Disposition: form-data; name="file"; filename="x.pdf"\r\n\r\n%PDF-x\r\n--x--\r\n' })
    assert.equal(response.statusCode, 500)
    assert.doesNotMatch(response.body, /secret|stack/)
  } finally { await app.close() }
})
