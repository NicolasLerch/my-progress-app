"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, ChevronRight, Dumbbell, KeyRound, LogOut, Ruler, Save, Scale } from "lucide-react"
import type { HistoryItemDTO, UserProfileDTO } from "@my-progress/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"

function formatMonthYear(dateString?: string) {
  if (!dateString) {
    return "Sin fecha"
  }

  return new Date(dateString).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  })
}

function countTrainingsThisMonth(items: HistoryItemDTO[]) {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  return items.filter((item) => {
    const date = new Date(item.date)
    return item.status === "completed" && date.getMonth() === month && date.getFullYear() === year
  }).length
}

export default function SettingsPage() {
  const { user, signOut, updatePassword } = useAuth()
  const [profile, setProfile] = useState<UserProfileDTO | null>(null)
  const [history, setHistory] = useState<HistoryItemDTO[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [weightInput, setWeightInput] = useState("")
  const [heightInput, setHeightInput] = useState("")
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const fullName = useMemo(() => {
    const name = profile?.user.name ?? (typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : "")
    const lastName =
      profile?.user.lastName ??
      (typeof user?.user_metadata?.lastName === "string" ? user.user_metadata.lastName : "")

    return [name, lastName].filter(Boolean).join(" ") || "Usuario"
  }, [profile, user])

  const totalWorkouts = useMemo(
    () => history.filter((item) => item.status === "completed").length,
    [history],
  )
  const trainingsThisMonth = useMemo(() => countTrainingsThisMonth(history), [history])

  useEffect(() => {
    let cancelled = false

    setIsLoadingProfile(true)

    void Promise.all([api.getProfile(), api.getHistory()])
      .then(([profilePayload, historyPayload]) => {
        if (cancelled) {
          return
        }

        setProfile(profilePayload)
        setHistory(historyPayload)
        setWeightInput(profilePayload.user.weight != null ? String(profilePayload.user.weight) : "")
        setHeightInput(profilePayload.user.height != null ? String(profilePayload.user.height) : "")
      })
      .catch((cause: Error) => {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "No se pudo cargar el perfil",
            description: cause.message,
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProfile(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  function resetPasswordForm() {
    setNewPassword("")
    setConfirmPassword("")
    setPasswordError(null)
  }

  function handlePasswordDialogChange(open: boolean) {
    setPasswordDialogOpen(open)
    if (!open) {
      resetPasswordForm()
    }
  }

  async function handlePasswordSubmit() {
    const trimmedPassword = newPassword.trim()
    const trimmedConfirmPassword = confirmPassword.trim()

    if (!trimmedPassword || !trimmedConfirmPassword) {
      setPasswordError("Completa ambos campos para cambiar la contrasena.")
      return
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setPasswordError("Las contrasenas no coinciden.")
      return
    }

    setIsUpdatingPassword(true)
    setPasswordError(null)

    try {
      await updatePassword(trimmedPassword)
      toast({
        title: "Contrasena actualizada",
        description: "Tu contrasena se actualizo correctamente.",
      })
      handlePasswordDialogChange(false)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo actualizar la contrasena."
      setPasswordError(message)
      toast({
        variant: "destructive",
        title: "No se pudo cambiar la contrasena",
        description: message,
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  async function handleProfileSubmit() {
    const trimmedWeight = weightInput.trim()
    const trimmedHeight = heightInput.trim()
    const parsedWeight = trimmedWeight.length > 0 ? Number(trimmedWeight) : undefined
    const parsedHeight = trimmedHeight.length > 0 ? Number(trimmedHeight) : undefined

    if (trimmedWeight.length > 0 && (parsedWeight == null || !Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      setProfileError("El peso debe ser un numero mayor a 0.")
      return
    }

    if (trimmedHeight.length > 0 && (parsedHeight == null || !Number.isFinite(parsedHeight) || parsedHeight <= 0)) {
      setProfileError("La altura debe ser un numero mayor a 0.")
      return
    }

    setIsSavingProfile(true)
    setProfileError(null)

    try {
      const updatedProfile = await api.updateProfile({
        weight: parsedWeight,
        height: parsedHeight,
      })

      setProfile(updatedProfile)
      setWeightInput(updatedProfile.user.weight != null ? String(updatedProfile.user.weight) : "")
      setHeightInput(updatedProfile.user.height != null ? String(updatedProfile.user.height) : "")

      toast({
        title: "Perfil actualizado",
        description: "Peso, altura e IMC quedaron actualizados.",
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo guardar el perfil."
      setProfileError(message)
      toast({
        variant: "destructive",
        title: "No se pudo guardar el perfil",
        description: message,
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5 pb-4">
        <Card className="overflow-hidden border-border/50 bg-card">
          <CardContent className="p-0">
            <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />

            <div className="-mt-10 px-4 pb-4">
              <div className="flex items-end gap-4">
                <div className="flex size-20 items-center justify-center rounded-full border-4 border-card bg-card">
                  <span className="text-3xl font-bold text-primary">{fullName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 pb-1">
                  <h1 className="text-xl font-bold text-foreground">{fullName}</h1>
                  <p className="text-sm text-muted-foreground">
                    Miembro desde {profile?.user.createdAt ? formatMonthYear(profile.user.createdAt) : "sin fecha"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Altura</span>
                  <p className="font-semibold text-foreground">
                    {profile?.user.height != null ? `${profile.user.height} cm` : isLoadingProfile ? "..." : "No informada"}
                  </p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div>
                  <span className="text-muted-foreground">Peso</span>
                  <p className="font-semibold text-foreground">
                    {profile?.user.weight != null ? `${profile.user.weight} kg` : isLoadingProfile ? "..." : "No informado"}
                  </p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div>
                  <span className="text-muted-foreground">IMC</span>
                  <p className="font-semibold text-foreground">
                    {profile?.bmi != null ? profile.bmi.toFixed(1) : isLoadingProfile ? "..." : "Sin datos"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Resumen de estadisticas</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/50 bg-card">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
                  <Dumbbell className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalWorkouts}</p>
                  <p className="text-xs text-muted-foreground">Entrenamientos</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Calendar className="size-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{trainingsThisMonth}</p>
                  <p className="text-xs text-muted-foreground">Este mes</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Composicion corporal</h2>
          </div>
          <Card className="border-border/50 bg-card">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-weight">Peso (kg)</Label>
                  <Input
                    id="profile-weight"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="Ej: 82.5"
                    value={weightInput}
                    onChange={(event) => setWeightInput(event.target.value)}
                    disabled={isLoadingProfile || isSavingProfile}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-height">Altura (cm)</Label>
                  <Input
                    id="profile-height"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="Ej: 178"
                    value={heightInput}
                    onChange={(event) => setHeightInput(event.target.value)}
                    disabled={isLoadingProfile || isSavingProfile}
                  />
                  <p className="text-xs text-muted-foreground">Carga la altura en centimetros, no en metros.</p>
                </div>
              </div>

              {profileError ? <p className="mt-3 text-sm text-destructive">{profileError}</p> : null}

              <Button
                className="mt-4 w-full gap-2"
                onClick={() => void handleProfileSubmit()}
                disabled={isLoadingProfile || isSavingProfile}
              >
                <Save className="size-4" />
                {isSavingProfile ? "Guardando..." : "Guardar peso y altura"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Ajustes</h2>
          <Card className="border-border/50 bg-card">
            <CardContent className="divide-y divide-border/50 p-0">
              <button
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/50"
                onClick={() => setPasswordDialogOpen(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                    <KeyRound className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Cambiar contrasena</p>
                    <p className="text-xs text-muted-foreground">Actualiza el acceso de tu cuenta</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>

              <button
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50"
                onClick={() => void signOut()}
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10">
                  <LogOut className="size-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-destructive">Cerrar sesion</p>
                  <p className="text-xs text-muted-foreground">Finaliza la sesion en este dispositivo</p>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground">My Muscle App v1.0.0</p>
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogChange}>
        <DialogContent showCloseButton={!isUpdatingPassword}>
          <DialogHeader>
            <DialogTitle>Cambiar contrasena</DialogTitle>
            <DialogDescription>Introduce tu nueva contrasena y confirma el cambio.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">Nueva contrasena</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                aria-invalid={Boolean(passwordError)}
                disabled={isUpdatingPassword}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirmar contrasena</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-invalid={Boolean(passwordError)}
                disabled={isUpdatingPassword}
              />
            </div>
            {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handlePasswordDialogChange(false)} disabled={isUpdatingPassword}>
              Cancelar
            </Button>
            <Button onClick={() => void handlePasswordSubmit()} disabled={isUpdatingPassword}>
              {isUpdatingPassword ? "Guardando..." : "Guardar contrasena"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
