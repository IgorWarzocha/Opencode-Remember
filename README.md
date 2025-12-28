# Opencode Remember

Semantic long-term memory plugin for OpenCode. SQLite + local embeddings.

**Note**: This plugin prioritises speed and local-first operation using a lightweight embedding model. If you need sophisticated semantic understanding, look at enterprise solutions with larger models.

![opencode-remember](https://github.com/user-attachments/assets/a96265ca-da7e-4335-b09b-542ae5a03fce)

## Install

Add to `opencode.json`:

```json
{
  "plugin": ["@howaboua/opencode-remember@latest"]
}
```

First run downloads the embedding model (~88MB).

## Usage

Memories are injected after each user message:

```
<user_memories>
[important] User prefers functional components
[related] This project uses React 19
</user_memories>
```

### Tools

| Tool       | Description     |
| ---------- | --------------- |
| `remember` | Store a memory  |
| `recall`   | Search memories |
| `forget`   | Delete by ID    |

## Config

`.opencode/remember.jsonc`:

```jsonc
{
  "enabled": true,
  "scope": "both", // "global" | "project" | "both"
  "inject": {
    "count": 5,
    "highThreshold": 0.6,
  },
}
```

### Scope

| Value     | Search       | Save                         |
| --------- | ------------ | ---------------------------- |
| `project` | Project only | `.opencode/memory/`          |
| `global`  | Global only  | `~/.config/opencode/memory/` |
| `both`    | Both         | Agent decides per memory     |

## Storage

| Type    | Path                                         |
| ------- | -------------------------------------------- |
| Project | `.opencode/memory/memories.sqlite`           |
| Global  | `~/.config/opencode/memory/memories.sqlite`  |
| Model   | `~/.config/opencode/memory/models/` (shared) |

## License

MIT
