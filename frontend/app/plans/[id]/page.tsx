'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Pencil, Play, Trash2 } from 'lucide-react'
import type { PlanDTO } from '@my-progress/shared'
import { toast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [plan, setPlan] = useState<PlanDTO | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.getPlan(params.id).then(setPlan).catch(() => {})
  }, [params.id])

  async function handleDelete() {
    if (!plan) {
      return
    }

    setDeleting(true)

    try {
      await api.deletePlan(plan.id)
      toast({
        title: 'Plan eliminado',
        description: 'Se borraron el plan y todos sus registros asociados.',
      })
      router.push('/plans')
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'No se pudo eliminar el plan',
        description: cause instanceof Error ? cause.message : 'Ocurrio un error inesperado.',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (!plan) {
    return <p className="text-sm text-muted-foreground">Cargando plan...</p>
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{plan.name}</h1>
          <p className="text-sm text-muted-foreground">{plan.status} · {plan.totalDays} dias</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => api.activatePlan(plan.id).then(setPlan)}>
          <Play className="w-4 h-4" />
          Activar
        </Button>
      </div>

      <div className="flex gap-3">
        <Button asChild variant="outline" className="flex-1 gap-2">
          <Link href={`/plans/${plan.id}/edit`}>
            <Pencil className="w-4 h-4" />
            Editar plan
          </Link>
        </Button>
      </div>

      {plan.days.map((day) => (
        <Card key={day.id}>
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{day.name}</h2>
              <span className="text-xs text-muted-foreground">Dia {day.order}</span>
            </div>
            <div className="flex flex-col gap-2">
              {day.exercises.map((exercise) => (
                <div key={exercise.id} className="rounded-xl bg-secondary/60 px-3 py-2">
                  <p className="text-sm font-medium">{exercise.exerciseName}</p>
                  <p className="text-xs text-muted-foreground">
                    {exercise.targetSets} x {exercise.targetReps} · descanso {exercise.restSeconds}s
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="gap-2">
            <Trash2 className="w-4 h-4" />
            Eliminar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plan</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara el plan, sus dias, ejercicios y todas las sesiones y registros asociados. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Eliminando...' : 'Confirmar eliminacion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
