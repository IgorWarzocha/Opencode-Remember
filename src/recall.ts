/**
 * Recall tool - semantic search over stored memories.
 */
import { tool } from "@opencode-ai/plugin"
import { getDb, getAllMemories } from "./db"
import { getEmbedder, decodeEmbedding, cosineSimilarity } from "./embedder"
import type { PluginContext, MemoryResult, StorageContext } from "./types"

const DEFAULT_LIMIT = 5

function searchStore(store: StorageContext, queryVec: Float32Array): MemoryResult[] {
  if (!Bun.file(store.dbPath).size) return []

  const db = getDb(store.dbPath)
  const memories = getAllMemories(db)

  return memories.map((m) => ({
    id: m.id,
    content: m.content,
    timestamp: m.timestamp,
    score: cosineSimilarity(queryVec, decodeEmbedding(m.embedding)),
    source: store.source,
  }))
}

export function createRecallTool(ctx: PluginContext) {
  return tool({
    description: `Explicitly search stored memories with a custom query.

WHEN TO USE: Relevant memories are auto-injected after each user message via <user_memories> tag.
Use this tool only when you need to:
- Search with a different/broader query than the user's message
- Get more results than the auto-injected limit
- Verify if a memory exists before storing a new one
- Find memory IDs for deletion with the forget tool

In most cases, rely on <user_memories> - no need to call this tool.`,
    args: {
      query: tool.schema.string().describe("Natural language search query"),
      limit: tool.schema.number().optional().describe("Max results (default 5, max 20)"),
    },
    async execute(args) {
      const query = args.query.trim()
      if (!query) throw new Error("Query cannot be empty")

      if (ctx.stores.length === 0) return "No memory stores configured."

      const model = await getEmbedder(ctx.modelDir)
      const queryVec = new Float32Array(await model.queryEmbed(query))

      const results: MemoryResult[] = []
      for (const store of ctx.stores) {
        const exists = await Bun.file(store.dbPath).exists()
        if (!exists) continue
        results.push(...searchStore(store, queryVec))
      }

      if (results.length === 0) return "No memories stored yet. Use the remember tool first."

      results.sort((a, b) => b.score - a.score)
      const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_LIMIT, 20))
      const top = results.slice(0, limit)

      return top
        .map((r, i) => {
          const sourceTag = ctx.config.scope === "both" ? ` [${r.source}]` : ""
          return `${i + 1}. id=${r.id} [${r.score.toFixed(3)}]${sourceTag} ${r.content}`
        })
        .join("\n")
    },
  })
}
