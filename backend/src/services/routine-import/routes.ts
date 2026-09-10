import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'
import { FileImportService } from './service.js'
import { IMPORT_LIMITS, RoutineImportError } from './errors.js'

export async function registerRoutineImport(app: FastifyInstance, service: Pick<FileImportService, 'importFile'>) {
  await app.register(multipart, { limits: { fileSize: IMPORT_LIMITS.bytes, files: 1, fields: 0, parts: 1 } })
  let busy = false
  app.post('/plans/import', async (request, reply) => {
    const start = Date.now()
    if (busy) return reply.code(429).send({ code: 'IMPORT_BUSY', message: 'Hay una importación en curso. Intentá nuevamente en unos momentos.' })
    busy = true
    try {
      let upload: { data: Buffer; filename: string; mime: string } | undefined
      for await (const part of request.parts()) {
        if (part.type !== 'file') throw new RoutineImportError('INVALID_UPLOAD', 'Seleccioná un único archivo.', 400)
        upload = { data: await part.toBuffer(), filename: part.filename, mime: part.mimetype }
      }
      if (!upload) throw new RoutineImportError('EMPTY_FILE', 'Seleccioná un archivo para importar.', 400)
      const result = await service.importFile(upload.data, upload.filename, upload.mime)
      request.log.info({ stage: 'routine-import', durationMs: Date.now() - start, code: 'SUCCESS' }, 'Routine import finished')
      return result
    } catch (error: unknown) {
      let failure = error instanceof RoutineImportError ? error : new RoutineImportError('IMPORT_ERROR', 'No se pudo importar la rutina. Intentá nuevamente.', 500)
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
      if (code === 'FST_REQ_FILE_TOO_LARGE') failure = new RoutineImportError('FILE_TOO_LARGE', 'El archivo supera los 5 MiB.', 413)
      else if (typeof code === 'string' && code.startsWith('FST_')) failure = new RoutineImportError('INVALID_UPLOAD', 'Subí un único archivo .xlsx, .xls o .pdf.', 400)
      request.log.warn({ stage: 'routine-import', durationMs: Date.now() - start, code: failure.code }, 'Routine import failed')
      return reply.code(failure.statusCode).send({ code: failure.code, message: failure.message })
    } finally { busy = false }
  })
}
