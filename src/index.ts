/**
 * Semantic Memory Plugin - Long-term memory with embeddings for OpenCode.
 * Stores memories in SQLite with vector embeddings for semantic recall.
 * Automatically injects relevant memories after user messages.
 *
 * Configuration (.opencode/remember.jsonc or ~/.config/opencode/remember.jsonc):
 * - scope: "global" | "project" | "both"
 */
import type { Plugin } from "@opencode-ai/plugin"
import { ensureModel } from "./embedder"
import { getConfig } from "./config"
import { getModelDir, getStorageContexts } from "./storage"
import { createRememberTool } from "./remember"
import { createRecallTool } from "./recall"
import { createForgetTool } from "./forget"
import { createMessageHook } from "./inject"
import type { PluginContext } from "./types"

export const RememberPlugin: Plugin = async ({ worktree, directory }) => {
  const root = worktree && worktree !== "/" ? worktree : directory
  const config = getConfig(root)

  if (!config.enabled) return {}

  const modelDir = getModelDir()
  await ensureModel(modelDir)

  const stores = getStorageContexts(root, config.scope)
  const ctx: PluginContext = { root, modelDir, stores, config }

  return {
    "chat.message": createMessageHook(ctx),
    tool: {
      remember: createRememberTool(ctx),
      recall: createRecallTool(ctx),
      forget: createForgetTool(ctx),
    },
  }
}
