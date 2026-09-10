import test from 'node:test'
import assert from 'node:assert/strict'
import { pdf } from './pdf-fixture.mjs'
import { extractInWorker } from '../dist/services/routine-import/extraction-worker.js'
import { FileImportService } from '../dist/services/routine-import/service.js'
import { registerRoutineImport } from '../dist/services/routine-import/routes.js'
import Fastify from 'fastify'

test('compiled worker extracts PDF and distinguishes scanned/corrupt documents', async () => {
  assert.match(JSON.stringify(await extractInWorker(pdf('PRESS BANCA 4x10'), 'pdf')), /PRESS BANCA/)
  await assert.rejects(extractInWorker(pdf(''), 'pdf'), { code: 'SCANNED_PDF' })
  await assert.rejects(extractInWorker(Buffer.from('%PDF-broken'), 'pdf'), { code: 'INVALID_PDF' })
})
test('compiled HTTP pipeline extracts PDF before invoking interpretation', async () => {
  const app = Fastify()
  const service = new FileImportService(async () => [], { interpretRoutine: async content => {
    assert.match(JSON.stringify(content), /PRESS BANCA/)
    return { name: 'Rutina', days: [{ name: 'Pecho', exercises: [{ originalName: 'Press banca', sets: 4, reps: { min: 10, max: 10, text: '10' }, weight: null, weightUnit: null, restSeconds: null, notes: null, supersetGroupId: null }] }] }
  } })
  await registerRoutineImport(app, service)
  try {
    const response = await app.inject({ method: 'POST', url: '/plans/import', headers: { 'content-type': 'multipart/form-data; boundary=pdf-test' }, payload: Buffer.concat([
      Buffer.from('--pdf-test\r\nContent-Disposition: form-data; name="file"; filename="routine.pdf"\r\nContent-Type: application/pdf\r\n\r\n'), pdf('PRESS BANCA 4x10'), Buffer.from('\r\n--pdf-test--\r\n'),
    ]) })
    assert.equal(response.statusCode, 200, response.body)
  } finally { await app.close() }
})
