import createConnectionPool, { sql } from '@databases/sqlite'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { existsSync, statSync } from 'fs'

interface DatabaseInfo {
  path: string
  name: string
  size: number
  tables: string[]
  lastAccessed: Date
}

class DatabaseManager {
  private static instance: DatabaseManager
  private currentDb: ReturnType<typeof createConnectionPool> | null = null
  private currentDbInfo: DatabaseInfo | null = null

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  async loadDatabase(filePath: string, originalName: string): Promise<DatabaseInfo> {
    // Close existing connection if any
    await this.closeCurrentDatabase()

    try {
      // Open new connection
      this.currentDb = createConnectionPool(`file:${filePath}`)

      // Get database info
      const tables = await this.currentDb.query(sql`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).then(results => results.map(r => r.name as string))

      const stats = statSync(filePath)

      this.currentDbInfo = {
        path: filePath,
        name: originalName,
        size: stats.size,
        tables,
        lastAccessed: new Date()
      }

      return this.currentDbInfo
    } catch (error) {
      // Clean up on error
      if (existsSync(filePath)) {
        await unlink(filePath)
      }
      throw error
    }
  }

  async closeCurrentDatabase(): Promise<void> {
    if (this.currentDb) {
      await this.currentDb.dispose()
      this.currentDb = null
      this.currentDbInfo = null
    }
  }

  getCurrentDatabase(): ReturnType<typeof createConnectionPool> {
    if (!this.currentDb) {
      throw new Error('No database currently loaded')
    }
    return this.currentDb
  }

  getCurrentDatabaseInfo(): DatabaseInfo {
    if (!this.currentDbInfo) {
      throw new Error('No database currently loaded')
    }
    return this.currentDbInfo
  }

  isConnected(): boolean {
    return this.currentDb !== null
  }

  // Query execution with timeout
  async executeQuery(sqlQuery: string): Promise<any> {
    if (!this.currentDb) {
      throw new Error('No database currently loaded')
    }

    try {
      const isSelect = sqlQuery.trim().toLowerCase().startsWith('select')
      const result = await this.currentDb.query(sql`${sqlQuery}`)
      return isSelect ? result : { changes: result }
    } catch (error) {
      throw error
    }
  }
}

export const dbManager = DatabaseManager.getInstance() 