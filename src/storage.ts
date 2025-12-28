/**
 * Storage path resolution for memory databases.
 * Handles global, project, and combined storage scopes.
 */
import { join } from "path"
import { mkdirSync, existsSync } from "fs"
import { getGlobalConfigDir } from "./config"
import type { StorageScope, StorageContext } from "./types"

const MEMORY_DIRNAME = "memory"
const DB_FILENAME = "memories.sqlite"
const MODEL_DIRNAME = "models"

export function getModelDir() {
  const dir = join(getGlobalConfigDir(), MEMORY_DIRNAME, MODEL_DIRNAME)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getGlobalDbPath() {
  const dir = join(getGlobalConfigDir(), MEMORY_DIRNAME)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, DB_FILENAME)
}

export function getProjectDbPath(projectRoot: string) {
  const dir = join(projectRoot, ".opencode", MEMORY_DIRNAME)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, DB_FILENAME)
}

export function getStorageContexts(projectRoot: string, scope: StorageScope): StorageContext[] {
  switch (scope) {
    case "global":
      return [{ dbPath: getGlobalDbPath(), source: "global" }]
    case "project":
      return [{ dbPath: getProjectDbPath(projectRoot), source: "project" }]
    case "both":
      return [
        { dbPath: getProjectDbPath(projectRoot), source: "project" },
        { dbPath: getGlobalDbPath(), source: "global" },
      ]
  }
}

export function getPrimaryStore(projectRoot: string, scope: StorageScope): StorageContext {
  if (scope === "global") return { dbPath: getGlobalDbPath(), source: "global" }
  return { dbPath: getProjectDbPath(projectRoot), source: "project" }
}
