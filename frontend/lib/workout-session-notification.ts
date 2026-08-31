import type { WorkoutSessionDTO } from "@my-progress/shared"

function getNotificationTag(sessionId: string) {
  return `workout-session-${sessionId}`
}

function getRestTimerNotificationTag(sessionId: string, workoutExerciseId: string) {
  return `rest-timer-${sessionId}-${workoutExerciseId}`
}

export function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported" as const
  }

  return Notification.permission
}

export async function requestWorkoutNotificationPermission() {
  if (getNotificationPermission() === "unsupported") {
    return "unsupported" as const
  }

  return Notification.requestPermission()
}

export async function showActiveWorkoutNotification(session: WorkoutSessionDTO) {
  if (getNotificationPermission() !== "granted" || !("serviceWorker" in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  const options: NotificationOptions & {
    actions: Array<{ action: string; title: string }>
  } = {
    body: `${session.dayName}. Toca para retomarlo o finalizalo cuando termines.`,
    icon: "/apple-icon.png",
    badge: "/icon-light-32x32.png",
    tag: getNotificationTag(session.id),
    requireInteraction: true,
    data: { sessionId: session.id },
    actions: [{ action: "complete", title: "Finalizar" }],
  }

  await registration.showNotification("Entrenamiento en curso", options)
}

export async function showRestTimerNotification(input: {
  sessionId: string
  workoutExerciseId: string
  exerciseName: string
  overtimeSeconds: number
}) {
  if (getNotificationPermission() !== "granted" || !("serviceWorker" in navigator)) {
    return
  }

  const minutes = Math.floor(input.overtimeSeconds / 60)
  const seconds = input.overtimeSeconds % 60
  const overtime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  const registration = await navigator.serviceWorker.ready
  const options: NotificationOptions & { renotify: boolean } = {
    body: `Continúa con la próxima serie. Exceso: ${overtime}`,
    icon: "/apple-icon.png",
    badge: "/icon-light-32x32.png",
    tag: getRestTimerNotificationTag(input.sessionId, input.workoutExerciseId),
    requireInteraction: true,
    renotify: false,
    data: { sessionId: input.sessionId },
  }

  await registration.showNotification("Pausa terminada", options)
}

export async function closeActiveWorkoutNotification(sessionId: string) {
  if (!("serviceWorker" in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  const notifications = await registration.getNotifications({ tag: getNotificationTag(sessionId) })
  notifications.forEach((notification) => notification.close())
}

export async function closeRestTimerNotification(sessionId: string, workoutExerciseId: string) {
  if (!("serviceWorker" in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  const notifications = await registration.getNotifications({ tag: getRestTimerNotificationTag(sessionId, workoutExerciseId) })
  notifications.forEach((notification) => notification.close())
}

export async function closeRestTimerNotifications(sessionId: string) {
  if (!("serviceWorker" in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  const notificationTagPrefix = `rest-timer-${sessionId}-`
  const notifications = await registration.getNotifications()
  notifications
    .filter((notification) => notification.tag.startsWith(notificationTagPrefix))
    .forEach((notification) => notification.close())
}
