import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdirSync, readFileSync } from 'fs';
import { logger } from '../utils/logger';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: Database;
  private readonly dbPath: string;
  private readonly storagePath: string;

  private constructor() {
    // Get the project root directory
    const rootDir = process.cwd();
    
    // Set up storage paths
    this.storagePath = join(rootDir, 'storage');
    const dbDir = join(rootDir, 'src', 'db');
    
    // Create storage directories if they don't exist
    mkdirSync(this.storagePath, { recursive: true });
    mkdirSync(join(this.storagePath, 'results'), { recursive: true }); // For query results
    mkdirSync(join(this.storagePath, 'databases'), { recursive: true }); // For user databases
    
    // Initialize database path
    const envDbPath = process.env.DATABASE_PATH;
    if (envDbPath) {
      this.dbPath = envDbPath.startsWith('/') ? envDbPath : join(rootDir, envDbPath);
    } else {
      this.dbPath = join(dbDir, 'app.db');
    }
    
    logger.debug(`Database path: ${this.dbPath}`);

    // Initialize connection
    this.db = new Database(this.dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    
    // Initialize schema
    this.initializeSchema();
  }

  private initializeSchema(): void {
    try {
      // Load and execute schema
      const schemaPath = join(process.cwd(), 'src', 'db', 'schema.sql');
      logger.debug(`Loading schema from: ${schemaPath}`);
      const schema = readFileSync(schemaPath, 'utf8');
      
      // Execute schema (CREATE IF NOT EXISTS will handle idempotency)
      this.db.exec(schema);
      logger.info('Database schema initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  getDatabase(): Database {
    return this.db;
  }

  getStoragePath(type: 'results' | 'databases'): string {
    return join(this.storagePath, type);
  }

  // Transaction helper
  transaction<T>(callback: (db: Database) => T): T {
    this.db.exec('BEGIN');
    try {
      const result = callback(this.db);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // Cleanup
  close(): void {
    this.db.close();
  }
}

export const dbConnection = DatabaseConnection.getInstance();
export type { Database } from 'bun:sqlite'; 