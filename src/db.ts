/**
 * SQLite database operations for memory storage.
 * Handles schema creation, inserts, and queries.
 */
import { Database } from "bun:sqlite"
import type { Memory } from "./types"

export function getDb(dbPath: string) {
  const db = new Database(dbPath)
  db.run("PRAGMA journal_mode = WAL")
  db.run("PRAGMA synchronous = NORMAL")
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      embedding BLOB NOT NULL
    )
  `)
  return db
}

export function insertMemory(db: Database, content: string, timestamp: string, embedding: Buffer) {
  const stmt = db.prepare("INSERT INTO memories (content, timestamp, embedding) VALUES (?, ?, ?)")
  const result = stmt.run(content, timestamp, embedding)
  return result.lastInsertRowid as number
}

export function getAllMemories(db: Database): Memory[] {
  return db.query("SELECT id, content, timestamp, embedding FROM memories").all() as Memory[]
}

export function deleteMemory(db: Database, id: number) {
  db.run("DELETE FROM memories WHERE id = ?", [id])
}

export function countMemories(db: Database) {
  const row = db.query("SELECT COUNT(*) as count FROM memories").get() as { count: number }
  return row.count
}
