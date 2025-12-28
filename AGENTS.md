# AGENTS.md

## Build & Development

```bash
npm run build    # TypeScript compilation to dist/
npm run clean    # Remove dist/
npx tsc --noEmit # Type check
```

**Note**: No test framework. Use `bun test` when adding tests.

## Project Structure

```
src/
├── index.ts       # Plugin entry point, exports RememberPlugin
├── types.ts       # Core type definitions (PluginConfig, Memory, etc.)
├── config.ts      # Configuration loader (.opencode/remember.jsonc)
├── storage.ts     # Storage path resolution (global/project)
├── db.ts          # SQLite schema and CRUD operations
├── embedder.ts    # Embedding model wrapper and vector math
├── remember.ts    # Tool creation for storing memories
├── recall.ts      # Tool creation for semantic search
├── forget.ts      # Tool creation for deletion
└── inject.ts      # Message hook for auto-injecting memories
```

## Code Style Guidelines

### File Organization
- JSDoc header comment describing purpose
- Imports: external libs → internal imports → type imports
- Export functions/classes at file bottom
- One concern per file

### Import Style
```typescript
import { Database } from "bun:sqlite"
import { tool } from "@opencode-ai/plugin"
import { getDb, insertMemory } from "./db"
import type { PluginContext, StorageContext } from "./types"
```
**Rules**: Named imports only (no `import * as`), `import type` for types, `./` prefix (no `../`).

### Naming Conventions
- **Files**: `lowercase.ts` (kebab-case for compounds)
- **Types**: `PascalCase` (e.g., `PluginConfig`, `MemoryResult`)
- **Functions**: `camelCase` (e.g., `getDb`, `createRememberTool`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_LIMIT`, `MIN_SCORE`)
- **Private**: No prefix (use `export` to control visibility)

### Type Definitions
```typescript
export type StorageScope = "global" | "project" | "both"
export type PluginConfig = { enabled: boolean; scope: StorageScope; inject: { count: number; highThreshold: number } }
type Part = { id: string; type: string; text?: string }  // Local types stay in module
```
**Rules**: Use `type` (not `interface`), exact types over `any`/`unknown`, explicit typing for callbacks, `tool.schema.string()`/`.number()` for validation.

### Function Design
```typescript
export function getDb(dbPath: string): Database {
  const db = new Database(dbPath)
  db.run("PRAGMA journal_mode = WAL")
  return db
}

export async function ensureModel(modelDir: string): Promise<void> {
  const exists = await fs.stat(modelPath).then(() => true).catch(() => false)
  if (exists) return
  await fs.mkdir(modelDir, { recursive: true })
  await getEmbedder(modelDir)
}
```
**Rules**: Keep under 30 lines, one job per function, return early for guards, throw explicit errors.

### Tool Creation Pattern
```typescript
export function createRememberTool(ctx: PluginContext) {
  return tool({
    description: `WHEN TO USE: Proactively store memories when you discover user preferences...
Good: "User prefers functional components over class components"
Bad: "The user told me they like functional components better"`,
    args: {
      memory: tool.schema.string().describe("A single short sentence to remember. Be specific and factual."),
      global: tool.schema.boolean().optional().describe("true = user-wide, false = project-specific"),
    },
    async execute(args) {
      const content = args.memory.trim()
      if (!content) throw new Error("Memory cannot be empty")
      return await saveMemory(ctx, content, store)
    },
  })
}
```
**Tool descriptions**: Start with WHEN TO USE, list scenarios, provide good/bad examples, mention constraints.

### Error Handling
```typescript
// Validation at entry
const content = args.memory.trim()
if (!content) throw new Error("Memory cannot be empty")

// File existence - return gracefully
const exists = await Bun.file(store.dbPath).exists()
if (!exists) return "No memories stored yet."

// Type guards for runtime validation
function isValidScope(value: unknown): value is StorageScope {
  if (typeof value !== "string") return false
  return ["global", "project", "both"].includes(value.trim())
}
```
**Rules**: Throw on invalid user input, return gracefully for missing optional resources, use type guards, user-facing error messages.

### Database Operations
```typescript
// Prepared statements for all queries
const stmt = db.prepare("INSERT INTO memories (content, timestamp, embedding) VALUES (?, ?, ?)")
const result = stmt.run(content, timestamp, embedding)

// Type-assert query results
const memories = db.query("SELECT id, content, timestamp, embedding FROM memories").all() as Memory[]
```
**Rules**: Always use prepared statements (prevent SQL injection), PRAGMA `journal_mode = WAL` and `synchronous = NORMAL`, type-assert results (`as Type`).

### Constants & Async Patterns
```typescript
const DEFAULT_LIMIT = 5
const MIN_SCORE = 0.3
const CONFIG_FILENAME = "remember.jsonc"

// Iteration over async batches
for await (const batch of model.passageEmbed([content], 1)) {
  embeddings.push(...batch)
}

// Singleton with caching
let embedder: FlagEmbedding | null = null
export async function getEmbedder(cacheDir: string) {
  if (embedder) return embedder
  embedder = await FlagEmbedding.init({ ... })
  return embedder
}
```

### Comments
- File headers: single-line JSDoc with purpose
- Complex logic: brief "why" comment (not "what")
- Public APIs: JSDoc with params if not self-evident
- No commented code (git has history)

## TypeScript & Plugin Architecture

**Config**: Target ESNext, Module ESNext/bundler, Strict enabled, Types `bun-types`/`node`, Output `dist/` with declarations.

**Plugin**: OpenCode plugin (`@opencode-ai/plugin` peer dependency). Main export is `Plugin` function receiving `{ worktree, directory }`:

```typescript
return {
  "chat.message": createMessageHook(ctx),
  tool: { remember: createRememberTool(ctx), recall: createRecallTool(ctx), forget: createForgetTool(ctx) },
}
```

**PluginContext**: `root` (project root), `modelDir` (cached models), `stores` (SQLite paths), `config` (from `.opencode/remember.jsonc`).

## Tech Stack
- **Bun**: Runtime for `bun:sqlite` and file I/O
- **fastembed**: Local embeddings (no cloud APIs)
- **jsonc-parser**: Config parsing with comments
- **SQLite**: WAL mode for performance

## Configuration Scope Behavior

| Scope   | Stores Searched | Storage Location for New Memories |
|---------|-----------------|-----------------------------------|
| `global` | Global only     | `~/.config/opencode/memory/`      |
| `project`| Project only    | `.opencode/memory/`               |
| `both`   | Both stores     | LLM decides via `global` argument |

When adding storage features, update `getStorageContexts()` and `createRememberTool()`.
