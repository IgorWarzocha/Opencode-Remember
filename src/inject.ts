/**
 * Memory injection hook - appends relevant memories after user messages.
 * Uses semantic search to find top-K memories matching the user's message.
 */
import { getDb, getAllMemories } from "./db"
import { getEmbedder, decodeEmbedding, cosineSimilarity } from "./embedder"
import type { PluginContext, MemoryResult, StorageContext } from "./types"

const MIN_SCORE = 0.3

type Part = {
  id: string
  sessionID: string
  messageID: string
  type: string
  text?: string
  synthetic?: boolean
}

function searchStore(store: StorageContext, queryVec: Float32Array): MemoryResult[] {
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

async function searchMemories(ctx: PluginContext, query: string): Promise<MemoryResult[]> {
  if (!query.trim()) return []

  const results: MemoryResult[] = []

  for (const store of ctx.stores) {
    const exists = await Bun.file(store.dbPath).exists()
    if (!exists) continue
    const db = getDb(store.dbPath)
    if (getAllMemories(db).length === 0) continue

    const model = await getEmbedder(ctx.modelDir)
    const queryVec = new Float32Array(await model.queryEmbed(query))
    results.push(...searchStore(store, queryVec))
  }

  const count = ctx.config.inject.count

  return results
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
}

function extractUserText(parts: Part[]): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join(" ")
    .slice(0, 500)
}

function formatMemoriesTag(memories: MemoryResult[], ctx: PluginContext): string {
  const threshold = ctx.config.inject.highThreshold
  const showSource = ctx.config.scope === "both"

  const lines = memories.map((m) => {
    const relevanceTag = m.score >= threshold ? "[important]" : "[related]"
    const sourceTag = showSource ? ` [${m.source}]` : ""
    return `${relevanceTag}${sourceTag} ${m.content}`
  })

  return `<user_memories>\n${lines.join("\n")}\n</user_memories>`
}

function generatePartId() {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createMessageHook(ctx: PluginContext) {
  return async (input: { sessionID: string; messageID?: string }, output: { message: unknown; parts: Part[] }) => {
    const query = extractUserText(output.parts)
    if (!query) return

    const memories = await searchMemories(ctx, query)
    if (memories.length === 0) return

    const tag = formatMemoriesTag(memories, ctx)

    const sessionID = input.sessionID
    const messageID = input.messageID ?? output.parts[0]?.messageID ?? ""

    output.parts.push({
      id: generatePartId(),
      sessionID,
      messageID,
      type: "text",
      text: `\n\n${tag}`,
      synthetic: true,
    })
  }
}
