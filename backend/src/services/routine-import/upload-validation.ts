import { IMPORT_LIMITS as LIMIT, RoutineImportError } from './errors.js'
export type ImportFormat = 'xlsx' | 'xls' | 'pdf'
export function validateUpload(data: Buffer, filename: string, mime: string): ImportFormat {
  if (!data.length) throw new RoutineImportError('EMPTY_FILE', 'El archivo está vacío.', 400)
  if (data.length > LIMIT.bytes) throw new RoutineImportError('FILE_TOO_LARGE', 'El archivo supera los 5 MiB.', 413)
  const extension = filename.toLowerCase().split('.').pop()
  const allowed: Record<ImportFormat, string[]> = {
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    xls: ['application/vnd.ms-excel'], pdf: ['application/pdf'],
  }
  if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'pdf') throw new RoutineImportError('UNSUPPORTED_FORMAT', 'Formato no soportado. Usá .xlsx, .xls o .pdf.', 415)
  if (!allowed[extension].includes(mime) && mime !== 'application/octet-stream' && mime !== '') throw new RoutineImportError('INVALID_MIME', 'El tipo del archivo no coincide con su extensión.', 415)
  const signatureValid = extension === 'pdf' ? data.subarray(0, 5).toString() === '%PDF-' : extension === 'xlsx' ? data.length >= 4 && data.readUInt32LE(0) === 0x04034b50 : data.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))
  if (!signatureValid) throw new RoutineImportError('INVALID_FILE', 'El contenido del archivo no coincide con su formato.', 422)
  return extension
}

