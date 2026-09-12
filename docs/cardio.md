# Cardio

Los ejercicios tienen `type: STRENGTH | CARDIO`. Los existentes siguen siendo
`STRENGTH`. La migración agrega cinco entradas cardio al catálogo sin modificar
ejercicios ni entrenamientos anteriores.

## Planificación y registro

En un plan, cardio requiere `targetDurationMinutes`; `targetSets`, `targetReps`
y `restSeconds` quedan en `null`. La sesión copia el objetivo del plan para que
una edición posterior del plan no cambie el historial. Un entrenamiento libre
puede incluir cardio sin objetivo.

El plan también permite indicar `targetDistanceMeters` y/o `targetInclinePercent`
como objetivos opcionales. Se copian a la sesión y se muestran como referencia;
no se autocompletan como resultados realizados. Dejarlos vacíos al editar elimina
el objetivo; cero se conserva como valor válido. Ambos campos están visibles en
el formulario de cardio, tanto en el plan como durante la sesión.

El resultado se guarda en una relación 1:1 `WorkoutExercise.cardioResult`:

```http
PUT /workout-sessions/:id/exercises/:workoutExerciseId/cardio-result
Authorization: Bearer <token>
Content-Type: application/json

{"durationMinutes":15}
```

La respuesta es la sesión completa. `durationMinutes` debe ser un entero
positivo. `distanceMeters` admite enteros no negativos e `inclinePercent`
números finitos no negativos. Ambos son opcionales: omitirlos o enviar `null`
borra el valor anterior; `0` se conserva como valor registrado. Los enteros
no pueden superar `2147483647`.

El backend valida el tipo contra el catálogo, la pertenencia del ejercicio a
la sesión y la propiedad del usuario. Devuelve 400 para datos incompatibles y
404 para sesiones o ejercicios ajenos/inexistentes. Cardio no admite series
ni superseries; los reemplazos deben ser del mismo tipo y no tener resultados.

La UI diferencia el objetivo de los minutos realizados y permite registrar una
duración menor. El historial conserva ambos valores. Cardio no aporta volumen,
PR ni puntos al progreso de fuerza. Los gráficos de cardio quedan pendientes.

## Persistencia local

IndexedDB conserva borradores, sesiones y operaciones de fuerza/cardio en la
cola existente. Cada operación nueva tiene una revisión para que una respuesta
anterior no elimine una edición posterior. Se sincroniza por sesión, al guardar,
al reconectar, al reabrir y antes de finalizar. Los errores mantienen la cola y
el indicador pendiente; la finalización requiere sincronizar todos los registros.
Sin conexión se recupera exclusivamente la sesión local activa del usuario.

En la revisión de archivos importados se conserva el tipo del catálogo y se
solicitan los minutos objetivo manualmente. No se convierten repeticiones o
series importadas en minutos.

## Despliegue

1. Instalar dependencias y generar el cliente Prisma:
   `pnpm install --frozen-lockfile` y `pnpm --filter backend prisma:generate`.
2. Con `DATABASE_URL`/`DIRECT_URL` apuntando al entorno de destino, ejecutar
   `pnpm --filter backend exec prisma migrate deploy`.
3. Ejecutar `pnpm build` y desplegar backend y frontend coordinadamente.

La migración `20260912_add_cardio` incluye el catálogo inicial; no hace falta
ejecutar el seed. El seed existente elimina los datos y se reserva para bases
descartables. Los clientes antiguos de fuerza siguen siendo compatibles;
actualizar la PWA antes de editar planes con cardio.

La migración adicional `20260912_add_cardio_targets` agrega distancia e inclinación
objetivo. También se aplica con `prisma migrate deploy`, aunque la primera migración
de cardio ya esté instalada.

## Verificación

- `pnpm typecheck`
- `pnpm --filter @my-progress/shared test`
- `pnpm --filter frontend test` (IndexedDB simulado y sincronización concurrente)
- `pnpm --filter backend test`
- `pnpm build`

Las pruebas PostgreSQL del backend requieren `TEST_DATABASE_URL` explícita y
una base aislada con todas las migraciones aplicadas. Sin esa variable se omiten;
nunca usan la base de desarrollo/producción como alternativa. Cubren también
las rutas HTTP reales y el historial de sesiones mixtas.

En PowerShell puede usarse `pnpm.cmd` si la política local bloquea `pnpm.ps1`.
