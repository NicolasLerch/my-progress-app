import { Worker } from 'node:worker_threads'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { rawRoutineContentSchema, type RawRoutineContent } from '@my-progress/shared'
import type { ImportFormat } from './upload-validation.js'
import { RoutineImportError } from './errors.js'

export function extractInWorker(data: Buffer, format: ImportFormat): Promise<RawRoutineContent> {
  const source = new URL(new URL(import.meta.url).pathname.endsWith('.ts') ? './extractors.ts' : './extractors.js', import.meta.url).href
  return new Promise((resolve, reject) => {
    let initialized = false
    let content: RawRoutineContent | undefined
    let failure: RoutineImportError | undefined
    const extractScript = `
      const extract = async (workerData, postMessage) => {
        let initialized = false;
        try {
          // Avoid transforming the prebuilt PDF bundle through the development TS loader.
          const pdf = workerData.format === 'pdf' ? await import('pdf-parse') : undefined;
          const module = workerData.source.endsWith('.ts')
            ? await (await import('tsx/esm/api')).tsImport(workerData.source, workerData.source)
            : await import(workerData.source);
          initialized = true;
          postMessage({ stage: 'ready' });
          postMessage({ ok: true, content: await module.extractContent(workerData.data, workerData.format, pdf?.PDFParse) });
        } catch (error) {
          const controlled = typeof error.code === 'string' && !error.code.startsWith('ERR_');
          postMessage({ ok: false, code: controlled ? error.code : (initialized ? 'EXTRACTION_FAILED' : 'EXTRACTION_INIT'), message: controlled ? error.message : 'No se pudo iniciar o completar la extracción del archivo.' });
        }
      };`
    // PDF's native canvas dependency can crash Node when repeatedly unloaded from threads
    // on Windows. A bounded process isolates native teardown as well as JS allocations.
    const worker = format === 'pdf'
      ? spawn(process.execPath, ['--max-old-space-size=256', '--max-semi-space-size=16', '--eval', `${extractScript}
          process.once('message', async data => {
            await extract(data, message => process.send(message));
            process.disconnect();
          });`], { cwd: fileURLToPath(new URL('../../../', import.meta.url)), windowsHide: true, serialization: 'advanced', stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
      : new Worker(`${extractScript}
          const { parentPort, workerData } = require('node:worker_threads');
          extract(workerData, message => parentPort.postMessage(message));`, { eval: true, execArgv: [], workerData: { source, data, format }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 } })
    if (!(worker instanceof Worker)) {
      worker.send({ source, data, format })
      // Classify OOM without recording native stderr or document content.
      let diagnostics = ''
      worker.stderr?.on('data', (chunk: Buffer) => {
        diagnostics = (diagnostics + chunk.toString()).slice(-2048)
        if (/heap out of memory|allocation failed/i.test(diagnostics)) failure = new RoutineImportError('EXTRACTION_MEMORY', 'El archivo necesita más memoria de la permitida. Subí una versión más pequeña.')
      })
    }
    const timer = setTimeout(() => {
      failure = new RoutineImportError('EXTRACTION_TIMEOUT', 'El archivo tardó demasiado en procesarse. Subí una versión más pequeña.')
      if (worker instanceof Worker) void worker.terminate()
      else worker.kill()
    }, 15000)
    worker.on('message', (message: unknown) => {
      if (typeof message !== 'object' || message === null) {
        failure = new RoutineImportError('EXTRACTION_FAILED', 'No se pudo procesar el archivo.')
        return
      }
      if ('stage' in message && message.stage === 'ready') { initialized = true; return }
      if ('ok' in message && message.ok && 'content' in message) {
        const parsed = rawRoutineContentSchema.safeParse(message.content)
        if (parsed.success) { content = parsed.data; return }
      }
      const code = 'code' in message && typeof message.code === 'string' ? message.code : 'EXTRACTION_FAILED'
      const detail = 'message' in message && typeof message.message === 'string' ? message.message : 'No se pudo procesar el archivo.'
      failure = new RoutineImportError(code, detail)
    })
    worker.once('error', (error: Error & { code?: string }) => {
      const code = error.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'EXTRACTION_MEMORY' : initialized ? 'EXTRACTION_FAILED' : 'EXTRACTION_INIT'
      failure = new RoutineImportError(code, code === 'EXTRACTION_MEMORY' ? 'El archivo necesita más memoria de la permitida. Subí una versión más pequeña.' : 'No se pudo iniciar o completar la extracción del archivo.')
    })
    // Wait for native parser cleanup before releasing the concurrency slot or starting another worker.
    worker.once('exit', (code) => {
      clearTimeout(timer)
      if (failure) reject(failure)
      else if (code === 0 && content) resolve(content)
      else reject(new RoutineImportError('EXTRACTION_EXIT', 'El procesamiento del archivo se interrumpió.'))
    })
  })
}
