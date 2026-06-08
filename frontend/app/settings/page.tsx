"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const fullName = useMemo(() => {
    const name = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : ""
    const lastName = typeof user?.user_metadata?.lastName === "string" ? user.user_metadata.lastName : ""

    return [name, lastName].filter(Boolean).join(" ") || "Usuario"
  }, [user])

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Gestion de sesion y datos basicos de tu cuenta.</p>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-col gap-2">
          <p className="text-sm font-medium">{fullName}</p>
          <p className="text-sm text-muted-foreground">{user?.email ?? "Sin sesion conectada"}</p>
          <p className="text-sm text-muted-foreground">
            Fecha de nacimiento: {typeof user?.user_metadata?.birthDate === "string" ? user.user_metadata.birthDate : "No informada"}
          </p>
          <Button className="mt-2 w-full" variant="outline" onClick={() => void signOut()}>
            Cerrar sesion
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
