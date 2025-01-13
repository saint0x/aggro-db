import createConnectionPool, { sql } from '@databases/sqlite'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { logger } from './logger'

interface QueryHistoryEntry {
  id: number
  query: string
  database_name: string
  executed_at: string
  execution_time_ms: number
  success: boolean
  error_message?: string
}

interface UserPreferences {
  id: number
  key: string
  value: string
}

class AppDatabase {
  private static instance: AppDatabase
  private db: ReturnType<typeof createConnectionPool>
  private readonly dbPath: string

  private constructor() {
    // Ensure storage directory exists
    const storageDir = join(process.cwd(), 'storage')
    const dbDir = join(storageDir, 'app')
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    this.dbPath = join(dbDir, 'app.db')
    
    // Ensure database file exists
    if (!existsSync(this.dbPath)) {
      logger.debug(`Creating app database file at: ${this.dbPath}`)
      writeFileSync(this.dbPath, '') // Create empty file
    }

    // Initialize connection
    logger.debug(`Connecting to app database at: ${this.dbPath}`)
    this.db = createConnectionPool(`file:${this.dbPath}?mode=rwc`)
    this.initialize()
  }

  static getInstance(): AppDatabase {
    if (!AppDatabase.instance) {
      AppDatabase.instance = new AppDatabase()
    }
    return AppDatabase.instance
  }

  private async initialize() {
    try {
      // Enable foreign keys
      await this.db.query(sql`PRAGMA foreign_keys = ON`)

      // Create tables if they don't exist
      await this.db.query(sql`
        -- Query History
        CREATE TABLE IF NOT EXISTS query_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query TEXT NOT NULL,
          database_name TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          execution_time_ms INTEGER NOT NULL,
          success BOOLEAN NOT NULL,
          error_message TEXT
        );

        -- User Preferences
        CREATE TABLE IF NOT EXISTS user_preferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Database Metadata (for paid features)
        CREATE TABLE IF NOT EXISTS database_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          path TEXT UNIQUE NOT NULL,
          size INTEGER NOT NULL,
          table_count INTEGER NOT NULL,
          last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_favorite BOOLEAN DEFAULT 0,
          notes TEXT
        );
      `)
      logger.success('App database initialized')
    } catch (error) {
      logger.error('Failed to initialize app database:', error)
      throw error
    }
  }

  // Query History Methods
  async addQueryToHistory(entry: Omit<QueryHistoryEntry, 'id'>): Promise<QueryHistoryEntry> {
    const result = await this.db.query(sql`
      INSERT INTO query_history (query, database_name, execution_time_ms, success, error_message)
      VALUES (${entry.query}, ${entry.database_name}, ${entry.execution_time_ms}, ${entry.success}, ${entry.error_message})
      RETURNING *
    `)
    return result[0] as QueryHistoryEntry
  }

  async getRecentQueries(limit = 50): Promise<QueryHistoryEntry[]> {
    return this.db.query(sql`
      SELECT * FROM query_history
      ORDER BY executed_at DESC
      LIMIT ${limit}
    `) as Promise<QueryHistoryEntry[]>
  }

  // User Preferences Methods
  async setPreference(key: string, value: string): Promise<void> {
    await this.db.query(sql`
      INSERT INTO user_preferences (key, value)
      VALUES (${key}, ${value})
      ON CONFLICT(key) DO UPDATE SET
        value = ${value},
        updated_at = CURRENT_TIMESTAMP
    `)
  }

  async getPreference(key: string): Promise<string | null> {
    const result = await this.db.query(sql`
      SELECT value FROM user_preferences WHERE key = ${key}
    `)
    return result[0]?.value ?? null
  }

  async getAllPreferences(): Promise<Record<string, string>> {
    const prefs = await this.db.query(sql`
      SELECT key, value FROM user_preferences
    `) as { key: string, value: string }[]
    return Object.fromEntries(prefs.map(p => [p.key, p.value]))
  }

  // Database Metadata Methods (for paid features)
  async updateDatabaseMetadata(metadata: {
    name: string
    path: string
    size: number
    table_count: number
    is_favorite?: boolean
    notes?: string
  }): Promise<void> {
    await this.db.query(sql`
      INSERT INTO database_metadata (
        name, path, size, table_count, is_favorite, notes, last_accessed
      ) VALUES (
        ${metadata.name}, ${metadata.path}, ${metadata.size}, ${metadata.table_count},
        ${metadata.is_favorite}, ${metadata.notes}, CURRENT_TIMESTAMP
      )
      ON CONFLICT(path) DO UPDATE SET
        name = ${metadata.name},
        size = ${metadata.size},
        table_count = ${metadata.table_count},
        is_favorite = COALESCE(${metadata.is_favorite}, is_favorite),
        notes = COALESCE(${metadata.notes}, notes),
        last_accessed = CURRENT_TIMESTAMP
    `)
  }

  async getFavoriteDatabases(): Promise<any[]> {
    return this.db.query(sql`
      SELECT * FROM database_metadata
      WHERE is_favorite = 1
      ORDER BY last_accessed DESC
    `)
  }

  // Cleanup method
  async close(): Promise<void> {
    await this.db.dispose()
  }
}

export const appDb = AppDatabase.getInstance()
export type { QueryHistoryEntry, UserPreferences } 