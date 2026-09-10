'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { RoutineImportResult } from '@my-progress/shared'
import { Button } from '@/components/ui/button'
import { RoutineImportUpload } from '@/components/plans/routine-import-upload'
import { toast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { buildPlanInput, PlanForm } from '@/components/plans/plan-form'

export default function NewPlanPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'manual' | 'import'>('manual')
  const [imported, setImported] = useState<RoutineImportResult | undefined>()

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Button variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => setMode('manual')}>Crear manualmente</Button>
        <Button variant={mode === 'import' ? 'default' : 'outline'} onClick={() => setMode('import')}>Importar rutina</Button>
      </div>
      <div hidden={mode !== 'import'}>
        {!imported ? (
          <RoutineImportUpload onImported={result => {
            setImported(result)
            toast({ title: 'Importación exitosa', description: 'Revisá la rutina antes de crearla.' })
          }} />
        ) : (
          <Button variant="ghost" onClick={() => setImported(undefined)}>Descartar preview e importar otro archivo</Button>
        )}
      </div>
      {(['manual', 'import'] as const).map(formMode => formMode === 'import' && !imported ? null : (
        <div key={formMode} hidden={mode !== formMode}>
          <PlanForm
            backHref="/plans"
            title={formMode === 'import' ? 'Revisá tu rutina' : 'Crear plan'}
            description="Define dias, ejercicios y objetivos para tu rutina."
            submitLabel={formMode === 'import' ? 'Crear rutina' : 'Guardar plan'}
            importedRoutine={formMode === 'import' ? imported : undefined}
            submittingLabel="Guardando plan..."
            onSubmit={async (values) => {
              try {
                const plan = await api.createPlan(buildPlanInput(values))
                toast({ title: 'Plan creado con exito', description: 'El nuevo plan quedo listo y activo.' })
                router.push(`/plans/${plan.id}`)
              } catch (error: unknown) {
                toast({ title: 'No se pudo crear el plan', description: error instanceof Error ? error.message : 'Intentá nuevamente.', variant: 'destructive' })
              }
            }}
          />
        </div>
      ))}
    </div>
  )
}
