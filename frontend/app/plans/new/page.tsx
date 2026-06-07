'use client'

import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { buildPlanInput, PlanForm } from '@/components/plans/plan-form'

export default function NewPlanPage() {
  const router = useRouter()

  return (
    <PlanForm
      backHref="/plans"
      title="Crear plan"
      description="Define dias, ejercicios y objetivos para tu rutina."
      submitLabel="Guardar plan"
      submittingLabel="Guardando plan..."
      onSubmit={async (values, exercises) => {
        const plan = await api.createPlan(buildPlanInput(values, exercises))
        toast({
          title: 'Plan creado con exito',
          description: 'El nuevo plan quedo listo y activo.',
        })
        window.setTimeout(() => {
          router.push(`/plans/${plan.id}`)
        }, 250)
      }}
    />
  )
}
