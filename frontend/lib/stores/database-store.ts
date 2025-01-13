interface StoredDatabase {
  path: string
  name: string
  lastAccessed: string
  tables: string[]
  size: number
}

class DatabaseStore {
  private static readonly STORAGE_KEY = 'db-browser-databases'
  private static readonly MAX_RECENT_DBS = 10

  // Get all stored databases
  static getStoredDatabases(): StoredDatabase[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  // Add or update a database entry
  static addDatabase(db: Omit<StoredDatabase, 'lastAccessed'>) {
    const databases = this.getStoredDatabases()
    
    // Remove existing entry if present
    const filtered = databases.filter(d => d.path !== db.path)
    
    // Add new entry at the start
    const newEntry: StoredDatabase = {
      ...db,
      lastAccessed: new Date().toISOString()
    }
    
    // Keep only the most recent databases
    const updated = [newEntry, ...filtered].slice(0, this.MAX_RECENT_DBS)
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated))
    return newEntry
  }

  // Remove a database entry
  static removeDatabase(path: string) {
    const databases = this.getStoredDatabases()
    const filtered = databases.filter(d => d.path !== path)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered))
  }

  // Update last accessed time
  static updateLastAccessed(path: string) {
    const databases = this.getStoredDatabases()
    const index = databases.findIndex(d => d.path === path)
    
    if (index !== -1) {
      databases[index].lastAccessed = new Date().toISOString()
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(databases))
    }
  }

  // Clear all stored database entries
  static clearAll() {
    localStorage.removeItem(this.STORAGE_KEY)
  }

  // Check if a database is already stored
  static isDatabaseStored(path: string): boolean {
    const databases = this.getStoredDatabases()
    return databases.some(d => d.path === path)
  }

  // Get most recently accessed database
  static getMostRecent(): StoredDatabase | null {
    const databases = this.getStoredDatabases()
    return databases[0] || null
  }
}

export { DatabaseStore, type StoredDatabase } 