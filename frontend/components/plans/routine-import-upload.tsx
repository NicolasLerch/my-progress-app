'use client'

import { useEffect, useRef, useState } from 'react'
import type { RoutineImportResult } from '@my-progress/shared'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

export function RoutineImportUpload({ onImported }: { onImported: (result: RoutineImportResult) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'selected' | 'uploading' | 'processing'>('selected')
  const [progress, setProgress] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort() } }, [])
  const busy = phase !== 'selected'
  function select(files: File[]) {
    if (busy) return
    setFile(null)
    setError('')
    if (files.length !== 1) { setError('Seleccioná un único archivo.'); return }
    const selected = files[0]
    if (!/\.(xlsx|xls|pdf)$/i.test(selected.name)) { setError('Formato no soportado. Usá .xlsx, .xls o .pdf.'); return }
    if (!selected.size) { setError('El archivo está vacío.'); return }
    if (selected.size > 5 * 1024 * 1024) { setError('El archivo supera los 5 MiB.'); return }
    setFile(selected)
  }
  async function upload() {
    if (!file || controller.current) return
    controller.current = new AbortController()
    setError(''); setProgress(0); setPhase('uploading')
    try {
      const result = await api.importRoutine(file, percent => { if (mounted.current) { setProgress(percent); if (percent === 100) setPhase('processing') } }, controller.current.signal)
      if (mounted.current) onImported(result)
    } catch (failure: unknown) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'No se pudo importar la rutina.')
    } finally {
      controller.current = null
      if (mounted.current) setPhase('selected')
    }
  }
  return <div className="space-y-4">
    <div className="rounded-2xl border-2 border-dashed p-6 space-y-3" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); select(Array.from(event.dataTransfer.files)) }}>
      <Label htmlFor="routine-file">Arrastrá tu rutina o seleccioná un archivo</Label>
      <p className="text-sm text-muted-foreground">Excel (.xlsx, .xls) o PDF con texto. Máximo 5 MiB. No se admiten fotos ni PDFs escaneados.</p>
      <Input id="routine-file" type="file" accept=".xlsx,.xls,.pdf" disabled={busy} onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = '' }} />
      {file ? <p className="text-sm break-all">Archivo seleccionado: {file.name}</p> : null}
    </div>
    <p className="text-xs text-muted-foreground">El contenido extraído se enviará a OpenAI para interpretar la rutina. Podrás revisarla antes de crear el plan.</p>
    <div role="status" aria-live="polite">
      {phase === 'uploading' ? <><p>Subiendo… {progress}%</p><Progress value={progress} /></> : null}
      {phase === 'processing' ? <p className="animate-pulse">Procesando la rutina…</p> : null}
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button type="button" disabled={!file || busy} onClick={upload}>{busy ? 'Importando…' : 'Importar rutina'}</Button>
  </div>
}
