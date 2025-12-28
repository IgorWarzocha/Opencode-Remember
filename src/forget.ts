/**
 * Forget tool - delete memories by ID.
 */
import { tool } from "@opencode-ai/plugin"
import { getDb, deleteMemory, countMemories } from "./db"
import { getPrimaryStore } from "./storage"
import type { PluginContext } from "./types"

export function createForgetTool(ctx: PluginContext) {
  return tool({
    description: `Delete a memory by its ID.

WHEN TO USE:
- User explicitly asks to forget something
- You stored incorrect or outdated information
- Removing duplicates (keep the better-worded one)

Use the recall tool first to find the memory ID.`,
    args: {
      id: tool.schema.number().describe("Memory ID from recall results"),
      global: tool.schema.boolean().optional().describe("Delete from global store instead of project (default: false)"),
    },
    async execute(args) {
      const source = args.global ? "global" : ctx.config.scope === "global" ? "global" : "project"
      const store = getPrimaryStore(ctx.root, source === "global" ? "global" : "project")

      const exists = await Bun.file(store.dbPath).exists()
      if (!exists) return "No memories stored yet."

      const db = getDb(store.dbPath)
      const before = countMemories(db)
      deleteMemory(db, args.id)
      const after = countMemories(db)

      if (before === after) return `Memory id=${args.id} not found in ${source} store.`
      return `Forgot memory id=${args.id} from ${source} store. ${after} memories remaining.`
    },
  })
}
