/**
 * Type definitions for the semantic memory plugin.
 */

export type StorageScope = "global" | "project" | "both"

export type PluginConfig = {
  enabled: boolean
  scope: StorageScope
  inject: {
    count: number
    highThreshold: number
  }
}

export type Memory = {
  id: number
  content: string
  timestamp: string
  embedding: Uint8Array
}

export type MemoryResult = {
  id: number
  content: string
  timestamp: string
  score: number
  source: "global" | "project"
}

export type StorageContext = {
  dbPath: string
  source: "global" | "project"
}

export type PluginContext = {
  root: string
  modelDir: string
  stores: StorageContext[]
  config: PluginConfig
}
