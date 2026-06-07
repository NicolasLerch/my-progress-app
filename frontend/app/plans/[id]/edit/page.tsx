'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { PlanDTO } from '@my-progress/shared'
import { toast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { buildPlanInput, PlanForm } from '@/components/plans/plan-form'

export default function EditPlanPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [plan, setPlan] = useState<PlanDTO | null>(null)

  useEffect(() => {
    api.getPlan(params.id).then(setPlan).catch(() => {})
  }, [params.id])

  if (!plan) {
    return <p className="text-sm text-muted-foreground">Cargando plan...</p>
  }

  return (
    <PlanForm
      backHref={`/plans/${plan.id}`}
      title="Editar plan"
      description="Actualiza dias, ejercicios y objetivos del plan seleccionado."
      submitLabel="Guardar cambios"
      submittingLabel="Guardando cambios..."
      initialPlan={plan}
      onSubmit={async (values, exercises) => {
        const input = buildPlanInput(values, exercises, {
          status: plan.status,
          startDate: plan.startDate,
          endDate: plan.endDate,
          currentDay: plan.currentDay,
        })

        const nextDays = input.days.map((day, dayIndex) => {
          const sourceDay = values.days[dayIndex]
          const dayId = sourceDay?.id ?? `day-${crypto.randomUUID()}`

          return {
            id: dayId,
            planId: plan.id,
            name: day.name,
            order: day.order,
            exercises: day.exercises.map((exercise, exerciseIndex) => ({
              id: sourceDay?.exercises[exerciseIndex]?.id ?? `plan-exercise-${crypto.randomUUID()}`,
              planDayId: dayId,
              ...exercise,
            })),
          }
        })

        const updated = await api.updatePlan(plan.id, {
          ...plan,
          ...input,
          days: nextDays,
        })

        toast({
          title: 'Plan actualizado',
          description: 'Los cambios se guardaron correctamente.',
        })

        window.setTimeout(() => {
          router.push(`/plans/${updated.id}`)
        }, 250)
      }}
    />
  )
}
