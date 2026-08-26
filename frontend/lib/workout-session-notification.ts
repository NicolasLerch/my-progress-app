import type { WorkoutSessionDTO } from "@my-progress/shared"

function getNotificationTag(sessionId: string) {
  return `workout-session-${sessionId}`
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

export async function closeActiveWorkoutNotification(sessionId: string) {
  if (!("serviceWorker" in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  const notifications = await registration.getNotifications({ tag: getNotificationTag(sessionId) })
  notifications.forEach((notification) => notification.close())
}
