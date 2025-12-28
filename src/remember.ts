/**
 * Remember tool - saves memories with embeddings to SQLite.
 * When scope is "both", exposes a `global` argument for LLM to decide storage location.
 */
import { tool } from "@opencode-ai/plugin"
import { getDb, insertMemory } from "./db"
import { getEmbedder, encodeEmbedding } from "./embedder"
import { getPrimaryStore, getGlobalDbPath, getProjectDbPath } from "./storage"
import type { PluginContext, StorageContext } from "./types"

const BASE_DESCRIPTION = `Save something to semantic long-term memory.

WHEN TO USE: Proactively store memories when you discover:
- User preferences or style choices (response format, coding style, communication preferences)
- Technical decisions or constraints mentioned in conversation
- Facts about the user or their workflow
- Corrections the user makes to your assumptions

WHAT TO STORE: One short, specific sentence per memory. Be factual, not conversational.
Good: "User prefers functional components over class components"
Bad: "The user told me they like functional components better"

AVOID DUPLICATES: Before storing, consider if a similar memory likely exists. Don't store the same fact twice.`

const BOTH_SCOPE_ADDENDUM = `

STORAGE LOCATION - decide based on content:
- global=true: User-wide facts that apply everywhere
  Examples: "User prefers dark mode", "User likes concise responses", "User uses Vim keybindings"
- global=false: Project-specific facts about this codebase
  Examples: "This repo uses pnpm", "API uses REST not GraphQL", "Tests use Vitest not Jest"`

async function saveMemory(ctx: PluginContext, content: string, store: StorageContext) {
  const db = getDb(store.dbPath)
  const model = await getEmbedder(ctx.modelDir)

  const embeddings: number[][] = []
  for await (const batch of model.passageEmbed([content], 1)) {
    embeddings.push(...batch)
  }

  const timestamp = new Date().toISOString()
  const id = insertMemory(db, content, timestamp, encodeEmbedding(embeddings[0]))

  const scopeLabel = store.source === "global" ? " (global)" : " (project)"
  return `Remembered (id=${id}${scopeLabel}): "${content}"`
}

export function createRememberTool(ctx: PluginContext) {
  const isBothScope = ctx.config.scope === "both"

  const baseArgs = {
    memory: tool.schema.string().describe("A single short sentence to remember. Be specific and factual."),
  }

  const bothArgs = {
    ...baseArgs,
    global: tool.schema.boolean().default(false).describe("true = user-wide preference, false = project-specific fact"),
  }

  if (isBothScope) {
    return tool({
      description: BASE_DESCRIPTION + BOTH_SCOPE_ADDENDUM,
      args: bothArgs,
      async execute(args) {
        const content = args.memory.trim()
        if (!content) throw new Error("Memory cannot be empty")

        const store: StorageContext = args.global
          ? { dbPath: getGlobalDbPath(), source: "global" }
          : { dbPath: getProjectDbPath(ctx.root), source: "project" }

        return await saveMemory(ctx, content, store)
      },
    })
  }

  return tool({
    description: BASE_DESCRIPTION,
    args: baseArgs,
    async execute(args) {
      const content = args.memory.trim()
      if (!content) throw new Error("Memory cannot be empty")

      const store = getPrimaryStore(ctx.root, ctx.config.scope)
      return await saveMemory(ctx, content, store)
    },
  })
}
