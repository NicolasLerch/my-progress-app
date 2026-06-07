"use client"

import { useEffect, useState } from "react"
import type { HomeTodayDTO } from "@my-progress/shared"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"

export default function SettingsPage() {
  const [data, setData] = useState<HomeTodayDTO | null>(null)

  useEffect(() => {
    api.getHome().then(setData).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Cuenta pendiente de integrar con el backend Prisma en la siguiente iteracion.</p>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-col gap-2">
          <p className="text-sm font-medium">{data?.user.name ?? "Usuario demo"}</p>
          <p className="text-sm text-muted-foreground">{data?.user.email ?? "Sin sesion conectada"}</p>
        </CardContent>
      </Card>
    </div>
  )
}
