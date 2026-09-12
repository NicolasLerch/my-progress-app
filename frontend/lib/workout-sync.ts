import type { PendingWorkoutOperation } from "./offline-workouts"

// One drain per session, including saves made while an earlier request is in flight.
export function createWorkoutQueueSync(dependencies: {
  list: (sessionId: string) => Promise<PendingWorkoutOperation[]>
  send: (operation: PendingWorkoutOperation) => Promise<unknown>
  remove: (id: string, revision?: string) => Promise<void>
  isOnline: () => boolean
}) {
  const running = new Map<string, Promise<boolean>>()
  return function flush(sessionId: string): Promise<boolean> {
    const current = running.get(sessionId)
    if (current) return current
    const task = (async () => {
      try {
        while (true) {
          const operations = await dependencies.list(sessionId)
          if (!operations.length) return true
          if (!dependencies.isOnline()) return false
          for (const operation of operations) {
            await dependencies.send(operation)
            await dependencies.remove(operation.id, operation.revision)
          }
        }
      } catch {
        return false
      }
    })().finally(() => running.delete(sessionId))
    running.set(sessionId, task)
    return task
  }
}
