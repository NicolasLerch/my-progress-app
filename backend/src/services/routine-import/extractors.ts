import { inflateRawSync } from 'node:zlib'
import type * as XLSX from 'xlsx'

import type { RawRoutineContent } from '@my-progress/shared'
import { IMPORT_LIMITS as LIMIT, RoutineImportError } from './errors.js'

import type { ImportFormat } from './upload-validation.js'
export { validateUpload } from './upload-validation.js'
export type { ImportFormat } from './upload-validation.js'
export interface RoutineExtractor { extract(data: Buffer): Promise<RawRoutineContent> }
const tooLarge = () => new RoutineImportError('CONTENT_TOO_LARGE', 'El documento tiene demasiado contenido. Subí una versión más pequeña.')

// Check every ZIP member before SheetJS decompresses it, including actual expanded size.
function validateWorkbookZip(data: Buffer) {
  let end = -1
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new Error('Missing ZIP directory')
  const entries = data.readUInt16LE(end + 10)
  if (entries > 2000 || data.readUInt16LE(end + 4) !== 0) throw tooLarge()
  let offset = data.readUInt32LE(end + 16)
  let total = 0
  let workbook = false
  for (let i = 0; i < entries; i++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP directory')
    const flags = data.readUInt16LE(offset + 8)
    const method = data.readUInt16LE(offset + 10)
    const compressedSize = data.readUInt32LE(offset + 20)
    const expandedSize = data.readUInt32LE(offset + 24)
    const nameLength = data.readUInt16LE(offset + 28)
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString()
    workbook ||= name === 'xl/workbook.xml'
    if (flags & 1) throw new Error('Encrypted ZIP')
    total += expandedSize
    if (total > LIMIT.expandedBytes) throw tooLarge()
    const local = data.readUInt32LE(offset + 42)
    if (data.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid ZIP member')
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28)
    if (start + compressedSize > data.length) throw new Error('Truncated ZIP')
    const bytes = data.subarray(start, start + compressedSize)
    const expanded = method === 0 ? bytes : method === 8 ? inflateRawSync(bytes, { maxOutputLength: Math.min(expandedSize + 1, LIMIT.expandedBytes) }) : null
    if (!expanded || expanded.length !== expandedSize) throw new Error('Invalid ZIP size')
    offset += 46 + nameLength + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32)
  }
  if (!workbook) throw new Error('Not an XLSX workbook')
}

export class ExcelExtractor implements RoutineExtractor {
  constructor(private readonly format: 'xls' | 'xlsx') {}
  async extract(data: Buffer): Promise<RawRoutineContent> {
    try {
      if (this.format === 'xlsx') validateWorkbookZip(data)
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(data, { type: 'buffer', cellText: true, cellFormula: false, cellHTML: false })
      if (workbook.SheetNames.length > LIMIT.sections) throw tooLarge()
      let count = 0
      const blocks: RawRoutineContent['blocks'] = []
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name]
        const rows = new Map<number, Array<{ column: number; text: string; comment: string | null }>>()
        for (const address of Object.keys(sheet)) {
          if (address.startsWith('!')) continue
          if (++count > LIMIT.cells) throw tooLarge()
          const cell = sheet[address] as XLSX.CellObject
          const text = cell.w ?? (cell.v == null ? '' : String(cell.v))
          const comment = cell.c?.map(item => item.t).join('\n') || null
          if (!text.trim() && !comment) continue
          const position = XLSX.utils.decode_cell(address)
          const cells = rows.get(position.r + 1) ?? []
          cells.push({ column: position.c + 1, text, comment })
          rows.set(position.r + 1, cells)
        }
        if (rows.size) blocks.push({ kind: 'table', source: name, rows: [...rows.entries()].sort(([a], [b]) => a - b).map(([row, cells]) => ({ row, cells: cells.sort((a, b) => a.column - b.column) })), merges: (sheet['!merges'] ?? []).map(range => XLSX.utils.encode_range(range)) })
      }
      return checkedContent({ blocks })
    } catch (error: unknown) {
      if (error instanceof RoutineImportError) throw error
      throw new RoutineImportError('INVALID_EXCEL', 'El Excel es inválido, está corrupto o protegido. Guardalo nuevamente como .xlsx e intentá otra vez.')
    }
  }
}
export class PdfExtractor implements RoutineExtractor {
  constructor(private readonly parserType?: typeof import('pdf-parse').PDFParse) {}
  async extract(data: Buffer): Promise<RawRoutineContent> {
    const PDFParse = this.parserType ?? (await import('pdf-parse')).PDFParse
    const parser = new PDFParse({ data: new Uint8Array(data) })
    try {
      const info = await parser.getInfo()
      if (info.total > LIMIT.sections) throw tooLarge()
      const blocks: RawRoutineContent['blocks'] = []
      for (let page = 1; page <= info.total; page++) {
        const result = await parser.getText({ partial: [page], pageJoiner: '' })
        const text = result.pages.map(item => item.text).join('\n').replace(/\u0000/g, '').trim()
        if (text) blocks.push({ kind: 'text', source: `Página ${page}`, text })
        if (JSON.stringify({ blocks }).length > LIMIT.characters) throw tooLarge()
      }
      if (!blocks.length) throw new RoutineImportError('SCANNED_PDF', 'El PDF no contiene texto extraíble. Esta versión todavía no soporta PDFs escaneados.')
      return checkedContent({ blocks })
    } catch (error: unknown) {
      if (error instanceof RoutineImportError) throw error
      if (error instanceof Error && /password/i.test(error.name)) throw new RoutineImportError('PROTECTED_PDF', 'El PDF está protegido. Subí una copia sin contraseña.')
      throw new RoutineImportError('INVALID_PDF', 'El PDF es inválido o está corrupto.')
    } finally { await parser.destroy().catch(() => undefined) }
  }
}
export function checkedContent(content: RawRoutineContent): RawRoutineContent {
  if (JSON.stringify(content).length > LIMIT.characters) throw tooLarge()
  if (!content.blocks.length) throw new RoutineImportError('NO_CONTENT', 'El archivo no contiene información para interpretar.')
  return content
}
export async function extractContent(data: Uint8Array, format: ImportFormat, pdfParser?: typeof import('pdf-parse').PDFParse): Promise<RawRoutineContent> {
  const extractor: RoutineExtractor = format === 'pdf' ? new PdfExtractor(pdfParser) : new ExcelExtractor(format)
  return extractor.extract(Buffer.from(data))
}
