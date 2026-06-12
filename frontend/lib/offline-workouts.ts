import type { WorkoutSessionDTO, WorkoutSetInputDTO } from "@my-progress/shared"

const DB_NAME = "my-progress-offline"
const DB_VERSION = 3
const SESSION_STORE = "sessionSnapshots"
const QUEUE_STORE = "pendingSetOps"
const DRAFT_STORE = "trainingDrafts"

interface PendingSetOperation {
  id: string
  sessionId: string
  workoutExerciseId: string
  payload: WorkoutSetInputDTO
}

export interface TrainingDraftExerciseState {
  expanded: boolean
  weight: string
  reps: string
}

export interface TrainingDraftSnapshot {
  id: string
  exercises: Record<string, TrainingDraftExerciseState>
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE, { keyPath: "id" })
      }
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: "id" })
      }
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        database.createObjectStore(DRAFT_STORE, { keyPath: "id" })
      }
    }
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => void,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)

    transaction.oncomplete = () => database.close()
    transaction.onerror = () => reject(transaction.error)
    callback(store)

    transaction.oncomplete = () => {
      database.close()
      resolve(undefined as T)
    }
  })
}

export async function saveSessionSnapshot(session: WorkoutSessionDTO) {
  if (typeof indexedDB === "undefined") {
    return
  }
  await withStore<void>(SESSION_STORE, "readwrite", (store) => {
    store.put(session)
  })
}

export async function getSessionSnapshot(sessionId: string) {
  if (typeof indexedDB === "undefined") {
    return undefined
  }
  const database = await openDatabase()
  return new Promise<WorkoutSessionDTO | undefined>((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE, "readonly")
    const request = transaction.objectStore(SESSION_STORE).get(sessionId)

    request.onsuccess = () => {
      database.close()
      resolve(request.result as WorkoutSessionDTO | undefined)
    }
    request.onerror = () => {
      database.close()
      reject(request.error)
    }
  })
}

export async function deleteSessionSnapshot(sessionId: string) {
  if (typeof indexedDB === "undefined") {
    return
  }
  await withStore<void>(SESSION_STORE, "readwrite", (store) => {
    store.delete(sessionId)
  })
}

export async function queueSetOperation(sessionId: string, workoutExerciseId: string, payload: WorkoutSetInputDTO) {
  if (typeof indexedDB === "undefined") {
    return
  }
  const operation: PendingSetOperation = {
    id: `${sessionId}-${workoutExerciseId}-${payload.setNumber}`,
    sessionId,
    workoutExerciseId,
    payload,
  }

  await withStore<void>(QUEUE_STORE, "readwrite", (store) => {
    store.put(operation)
  })
}

export async function listSetOperations(sessionId: string) {
  if (typeof indexedDB === "undefined") {
    return []
  }
  const database = await openDatabase()
  return new Promise<PendingSetOperation[]>((resolve, reject) => {
    const transaction = database.transaction(QUEUE_STORE, "readonly")
    const request = transaction.objectStore(QUEUE_STORE).getAll()

    request.onsuccess = () => {
      database.close()
      const operations = (request.result as PendingSetOperation[]).filter((item) => item.sessionId === sessionId)
      resolve(operations)
    }
    request.onerror = () => {
      database.close()
      reject(request.error)
    }
  })
}

export async function removeSetOperation(operationId: string) {
  if (typeof indexedDB === "undefined") {
    return
  }
  await withStore<void>(QUEUE_STORE, "readwrite", (store) => {
    store.delete(operationId)
  })
}

export async function clearSessionSetOperations(sessionId: string) {
  if (typeof indexedDB === "undefined") {
    return
  }

  const operations = await listSetOperations(sessionId)
  await withStore<void>(QUEUE_STORE, "readwrite", (store) => {
    operations.forEach((operation) => {
      store.delete(operation.id)
    })
  })
}

export async function saveTrainingDraft(snapshot: TrainingDraftSnapshot) {
  if (typeof indexedDB === "undefined") {
    return
  }
  await withStore<void>(DRAFT_STORE, "readwrite", (store) => {
    store.put(snapshot)
  })
}

export async function getTrainingDraft(sessionId: string) {
  if (typeof indexedDB === "undefined") {
    return undefined
  }
  const database = await openDatabase()
  return new Promise<TrainingDraftSnapshot | undefined>((resolve, reject) => {
    const transaction = database.transaction(DRAFT_STORE, "readonly")
    const request = transaction.objectStore(DRAFT_STORE).get(sessionId)

    request.onsuccess = () => {
      database.close()
      resolve(request.result as TrainingDraftSnapshot | undefined)
    }
    request.onerror = () => {
      database.close()
      reject(request.error)
    }
  })
}

export async function deleteTrainingDraft(sessionId: string) {
  if (typeof indexedDB === "undefined") {
    return
  }
  await withStore<void>(DRAFT_STORE, "readwrite", (store) => {
    store.delete(sessionId)
  })
}
