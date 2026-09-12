'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Pencil, Play, Trash2 } from 'lucide-react'
import type { PlanDTO, PlanExerciseDTO } from '@my-progress/shared'
import { AppLoadingIndicator } from '@/components/app-loading-indicator'
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
import { useAuthReady } from '@/hooks/use-auth-ready'

function getExerciseBlocks(exercises: PlanExerciseDTO[]) {
  const blocks: PlanExerciseDTO[][] = []

  for (let index = 0; index < exercises.length; index += 1) {
    const exercise = exercises[index]
    const nextExercise = exercises[index + 1]

    if (exercise.supersetGroupId && nextExercise?.supersetGroupId === exercise.supersetGroupId) {
      blocks.push([exercise, nextExercise])
      index += 1
      continue
    }

    blocks.push([exercise])
  }

  return blocks
}

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [plan, setPlan] = useState<PlanDTO | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { isLoading, isReady, session } = useAuthReady()

  useEffect(() => {
    if (!isReady) return
    api.getPlan(params.id).then(setPlan).catch(() => {})
  }, [isReady, params.id])

  useEffect(() => {
    if (!session) {
      setPlan(null)
    }
  }, [session])

  if (isLoading) {
    return <AppLoadingIndicator label="Verificando sesión..." />
  }

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
    return <AppLoadingIndicator label="Cargando plan..." />
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
              {getExerciseBlocks(day.exercises).map((block) => (
                <div key={block[0].id} className="rounded-xl bg-secondary/60 px-3 py-2">
                  {block.length === 2 ? (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Superserie
                    </p>
                  ) : null}
                  <div className={block.length === 2 ? "flex flex-col divide-y divide-border/60" : ""}>
                    {block.map((exercise, exerciseIndex) => (
                      <div key={exercise.id} className={block.length === 2 ? "py-2 first:pt-0 last:pb-0" : ""}>
                  <p className="text-sm font-medium">
                    {block.length === 2 ? `${exerciseIndex === 0 ? 'A1' : 'A2'} · ` : null}
                    {exercise.exerciseName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {exercise.type === "CARDIO" ? `${exercise.targetDurationMinutes} min objetivo` : `${exercise.targetSets} x ${exercise.targetReps} · descanso ${exercise.restSeconds}s`}
                    {exercise.type === "CARDIO" && exercise.targetDistanceMeters != null ? ` · ${exercise.targetDistanceMeters} m objetivo` : ""}
                    {exercise.type === "CARDIO" && exercise.targetInclinePercent != null ? ` · ${exercise.targetInclinePercent}% inclinación objetivo` : ""}
                  </p>
                </div>
                    ))}
                  </div>
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
