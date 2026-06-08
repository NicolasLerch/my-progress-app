"use client"

import { useState } from "react"
import { Eye, EyeOff, LoaderCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrio un error inesperado."
}

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login")
  const [loginLoading, setLoginLoading] = useState(false)
  const [signupLoading, setSignupLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false)
  const [signupPasswordVisible, setSignupPasswordVisible] = useState(false)
  const [createdUserModalOpen, setCreatedUserModalOpen] = useState(false)

  async function handleLogin(formData: FormData) {
    setLoginError(null)
    setLoginLoading(true)

    try {
      await signIn(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""))
    } catch (error) {
      setLoginError(getErrorMessage(error))
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleSignup(formData: FormData) {
    setSignupError(null)
    setSignupLoading(true)

    try {
      await signUp({
        name: String(formData.get("name") ?? "").trim(),
        lastName: String(formData.get("lastName") ?? "").trim() || undefined,
        birthDate: String(formData.get("birthDate") ?? "").trim() || undefined,
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      })
      setActiveTab("login")
      setCreatedUserModalOpen(true)
    } catch (error) {
      setSignupError(getErrorMessage(error))
    } finally {
      setSignupLoading(false)
    }
  }

  async function onLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await handleLogin(new FormData(event.currentTarget))
  }

  async function onSignupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await handleSignup(new FormData(event.currentTarget))
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
        <Card className="w-full border-border/50 bg-card/95 shadow-lg">
          <CardHeader className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">My Progress</p>
              <CardTitle className="text-2xl">Accede a tu progreso</CardTitle>
              <CardDescription>Inicia sesión o crea tu cuenta para sincronizar planes y entrenamientos.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "signup")} className="gap-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form className="flex flex-col gap-4" onSubmit={(event) => void onLoginSubmit(event)}>
                  <div className="grid gap-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        name="password"
                        type={loginPasswordVisible ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        className="pr-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1/2 right-1 -translate-y-1/2"
                        onClick={() => setLoginPasswordVisible((current) => !current)}
                        aria-label={loginPasswordVisible ? "Ocultar contrasena" : "Mostrar contrasena"}
                      >
                        {loginPasswordVisible ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>
                  {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}
                  <Button type="submit" className="h-11" disabled={loginLoading}>
                    {loginLoading ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="flex flex-col gap-4" onSubmit={(event) => void onSignupSubmit(event)}>
                  <div className="grid gap-2">
                    <Label htmlFor="signup-name">Nombre</Label>
                    <Input id="signup-name" name="name" autoComplete="given-name" required minLength={2} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signup-last-name">Apellido</Label>
                    <Input id="signup-last-name" name="lastName" autoComplete="family-name" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signup-birth-date">Fecha de nacimiento</Label>
                    <Input id="signup-birth-date" name="birthDate" type="date" autoComplete="bday" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        name="password"
                        type={signupPasswordVisible ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        className="pr-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1/2 right-1 -translate-y-1/2"
                        onClick={() => setSignupPasswordVisible((current) => !current)}
                        aria-label={signupPasswordVisible ? "Ocultar contrasena" : "Mostrar contrasena"}
                      >
                        {signupPasswordVisible ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>
                  {signupError ? <p className="text-sm text-destructive">{signupError}</p> : null}
                  <Button type="submit" className="h-11" disabled={signupLoading}>
                    {signupLoading ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      "Crear cuenta"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <Dialog open={createdUserModalOpen} onOpenChange={setCreatedUserModalOpen}>
        <DialogContent showCloseButton={false} onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Usuario creado</DialogTitle>
            <DialogDescription>
              Tu cuenta fue creada correctamente. Ahora puedes iniciar sesión con tu email y contraseña.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setCreatedUserModalOpen(false)
                setActiveTab("login")
              }}
            >
              Iniciar sesion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
