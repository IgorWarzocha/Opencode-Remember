/**
 * Configuration loader for the remember plugin.
 * Reads from .opencode/remember.jsonc in the project root.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { parse } from "jsonc-parser"
import type { PluginConfig, StorageScope } from "./types"

const CONFIG_FILENAME = "remember.jsonc"

const DEFAULT_CONFIG: PluginConfig = {
  enabled: true,
  scope: "project",
  inject: {
    count: 5,
    highThreshold: 0.6,
  },
}

function loadJsonc(filepath: string): Record<string, unknown> | null {
  if (!existsSync(filepath)) return null
  const content = readFileSync(filepath, "utf-8")
  return parse(content) as Record<string, unknown>
}

function isValidScope(value: unknown): value is StorageScope {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  return trimmed === "global" || trimmed === "project" || trimmed === "both"
}

function normalizeScope(value: string): StorageScope {
  return value.trim() as StorageScope
}

function parseInjectConfig(data: Record<string, unknown>, base: PluginConfig["inject"]): PluginConfig["inject"] {
  const inject = data.inject as Record<string, unknown> | undefined
  if (!inject) return base
  return {
    count: typeof inject.count === "number" ? inject.count : base.count,
    highThreshold: typeof inject.highThreshold === "number" ? inject.highThreshold : base.highThreshold,
  }
}

function createDefaultConfig(configPath: string) {
  const dir = join(configPath, "..")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const content = `{
  // Enable or disable the plugin
  "enabled": true,
  // Where to store memories: "global", "project", or "both"
  // - "global": ~/.config/opencode/memory/memories.sqlite (shared across projects)
  // - "project": .opencode/memory/memories.sqlite (project-specific)
  // - "both": search both, save to project
  "scope": "project",
  // Memory injection settings
  "inject": {
    // Number of memories to inject after user messages (default: 5)
    "count": 5,
    // Score threshold for [important] vs [related] tag (default: 0.6)
    "highThreshold": 0.6
  }
}
`
  writeFileSync(configPath, content, "utf-8")
}

export function getConfig(projectRoot: string): PluginConfig {
  const config: PluginConfig = {
    ...DEFAULT_CONFIG,
    inject: { ...DEFAULT_CONFIG.inject },
  }

  const configPath = join(projectRoot, ".opencode", CONFIG_FILENAME)
  const data = loadJsonc(configPath)

  if (data) {
    if (typeof data.enabled === "boolean") config.enabled = data.enabled
    if (isValidScope(data.scope)) config.scope = normalizeScope(data.scope as string)
    config.inject = parseInjectConfig(data, config.inject)
  } else {
    createDefaultConfig(configPath)
  }

  return config
}

export function getGlobalConfigDir() {
  return join(homedir(), ".config", "opencode")
}
