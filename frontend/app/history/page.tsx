"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { HistoryItemDTO } from "@my-progress/shared"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { api } from "@/lib/api"
import { formatShortDate, formatWeight } from "@/lib/format"

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItemDTO[]>([])
  const { isLoading, isReady, session } = useAuthReady()

  useEffect(() => {
    if (!isReady) return
    api.getHistory().then(setItems).catch(() => {})
  }, [isReady])

  useEffect(() => {
    if (!session) {
      setItems([])
    }
  }, [session])

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Verificando sesion...</p>
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Historial</h1>
        <p className="text-sm text-muted-foreground">Revisa exactamente que hiciste cada dia.</p>
      </div>
      {items.map((item) => (
        <Link href={`/history/${item.id}`} key={item.id}>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{item.dayName}</p>
                <p className="text-xs text-muted-foreground">{formatShortDate(item.date)} · {item.exerciseCount} ejercicios · {item.durationMinutes} min</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{item.status}</p>
                <p className="text-sm font-semibold text-primary">{formatWeight(item.totalVolume)}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
