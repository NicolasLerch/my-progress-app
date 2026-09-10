export class RoutineImportError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode = 422) { super(message) }
}
export const IMPORT_LIMITS = { bytes: 5 * 1024 * 1024, sections: 30, characters: 60000, expandedBytes: 20 * 1024 * 1024, cells: 30000 }
