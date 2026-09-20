import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { LogEntry, Planting } from '../types'

interface ImoDB extends DBSchema {
  plantings: {
    key: string
    value: Planting
    indexes: { createdAt: string }
  }
  logs: {
    key: string
    value: LogEntry
    indexes: { plantingId: string }
  }
}

let dbPromise: Promise<IDBPDatabase<ImoDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ImoDB>('imohori-navi', 1, {
      upgrade(db) {
        const plantings = db.createObjectStore('plantings', { keyPath: 'id' })
        plantings.createIndex('createdAt', 'createdAt')

        const logs = db.createObjectStore('logs', { keyPath: 'id' })
        logs.createIndex('plantingId', 'plantingId')
      },
    })
  }
  return dbPromise
}

function newId() {
  return crypto.randomUUID()
}

export async function listPlantings(): Promise<Planting[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('plantings', 'createdAt')
  return all.reverse()
}

export async function getPlanting(id: string): Promise<Planting | undefined> {
  const db = await getDB()
  return db.get('plantings', id)
}

export async function savePlanting(
  input: Omit<Planting, 'id' | 'createdAt'>,
): Promise<Planting> {
  const db = await getDB()
  const planting: Planting = {
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
  }
  await db.put('plantings', planting)
  return planting
}

export async function updatePlanting(planting: Planting): Promise<void> {
  const db = await getDB()
  await db.put('plantings', planting)
}

export async function deletePlanting(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['plantings', 'logs'], 'readwrite')
  await tx.objectStore('plantings').delete(id)
  const logIndex = tx.objectStore('logs').index('plantingId')
  let cursor = await logIndex.openCursor(IDBKeyRange.only(id))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function listLogs(plantingId: string): Promise<LogEntry[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('logs', 'plantingId', plantingId)
  return all.sort((a, b) => b.date.localeCompare(a.date))
}

export async function saveLog(input: Omit<LogEntry, 'id' | 'createdAt'>): Promise<LogEntry> {
  const db = await getDB()
  const entry: LogEntry = {
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
  }
  await db.put('logs', entry)
  return entry
}

export async function deleteLog(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('logs', id)
}
