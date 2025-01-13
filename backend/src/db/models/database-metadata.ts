import { Database } from 'bun:sqlite';
import { dbConnection } from '../connection';
import { logger } from '../../utils/logger';

export interface DatabaseMetadata {
  id: number;
  name: string;
  path: string;
  size: number;
  table_count: number;
  last_accessed: string;
  is_favorite: boolean;
  notes?: string;
  schema_cache?: string;
  schema_updated_at?: string;
  created_at?: string;
}

export class DatabaseMetadataModel {
  private db: Database;

  constructor() {
    this.db = dbConnection.getDatabase();
  }

  create(metadata: Omit<DatabaseMetadata, 'id' | 'last_accessed' | 'created_at'>): DatabaseMetadata {
    try {
      logger.debug('Creating database metadata:', metadata);

      // Start transaction
      this.db.exec('BEGIN IMMEDIATE');

      // Insert the record
      const insertStmt = this.db.prepare(`
        INSERT INTO database_metadata (
          name, path, size, table_count, is_favorite, notes, schema_cache, schema_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `);

      const result = insertStmt.get(
        metadata.name,
        metadata.path,
        metadata.size,
        metadata.table_count,
        metadata.is_favorite ? 1 : 0,
        metadata.notes || null,
        metadata.schema_cache || null,
        metadata.schema_updated_at || null
      ) as { id: number };

      if (!result || typeof result.id !== 'number') {
        throw new Error('Failed to get inserted ID');
      }

      // Get the inserted record
      const selectStmt = this.db.prepare(`
        SELECT 
          id, name, path, size, table_count, 
          datetime(last_accessed) as last_accessed,
          is_favorite, notes, schema_cache,
          datetime(schema_updated_at) as schema_updated_at,
          datetime(created_at) as created_at
        FROM database_metadata 
        WHERE id = ?
      `);

      const record = selectStmt.get(result.id) as DatabaseMetadata;

      if (!record) {
        throw new Error(`Failed to retrieve inserted record with ID ${result.id}`);
      }

      // Commit transaction
      this.db.exec('COMMIT');

      return record;
    } catch (error) {
      // Rollback transaction on error
      this.db.exec('ROLLBACK');
      logger.error('Failed to create database metadata:', error);
      throw error;
    }
  }

  findById(id: number): DatabaseMetadata | null {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, name, path, size, table_count, 
          datetime(last_accessed) as last_accessed,
          is_favorite, notes, schema_cache,
          datetime(schema_updated_at) as schema_updated_at,
          datetime(created_at) as created_at
        FROM database_metadata 
        WHERE id = ?
      `);
      return stmt.get(id) as DatabaseMetadata | null;
    } catch (error) {
      logger.error(`Failed to find database metadata with ID ${id}:`, error);
      return null;
    }
  }

  findByPath(path: string): DatabaseMetadata | null {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, name, path, size, table_count, 
          datetime(last_accessed) as last_accessed,
          is_favorite, notes, schema_cache,
          datetime(schema_updated_at) as schema_updated_at,
          datetime(created_at) as created_at
        FROM database_metadata 
        WHERE path = ?
      `);
      return stmt.get(path) as DatabaseMetadata | null;
    } catch (error) {
      logger.error(`Failed to find database metadata with path ${path}:`, error);
      return null;
    }
  }

  update(id: number, metadata: Partial<DatabaseMetadata>): DatabaseMetadata | null {
    try {
      const current = this.findById(id);
      if (!current) {
        throw new Error(`Database metadata with id ${id} not found`);
      }

      const updates = Object.entries(metadata)
        .filter(([key]) => !['id', 'last_accessed', 'created_at'].includes(key))
        .map(([key]) => `${key} = ?`)
        .join(', ');

      const values = Object.entries(metadata)
        .filter(([key]) => !['id', 'last_accessed', 'created_at'].includes(key))
        .map(([_, value]) => value === undefined ? null : value);

      const stmt = this.db.prepare(`
        UPDATE database_metadata 
        SET ${updates}, last_accessed = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(...values, id);
      return this.findById(id);
    } catch (error) {
      logger.error(`Failed to update database metadata with ID ${id}:`, error);
      return null;
    }
  }

  delete(id: number): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM database_metadata WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      logger.error(`Failed to delete database metadata with ID ${id}:`, error);
      return false;
    }
  }

  list(): DatabaseMetadata[] {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, name, path, size, table_count, 
          datetime(last_accessed) as last_accessed,
          is_favorite, notes, schema_cache,
          datetime(schema_updated_at) as schema_updated_at,
          datetime(created_at) as created_at
        FROM database_metadata 
        ORDER BY last_accessed DESC
      `);
      return stmt.all() as DatabaseMetadata[];
    } catch (error) {
      logger.error('Failed to list database metadata:', error);
      return [];
    }
  }

  listFavorites(): DatabaseMetadata[] {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, name, path, size, table_count, 
          datetime(last_accessed) as last_accessed,
          is_favorite, notes, schema_cache,
          datetime(schema_updated_at) as schema_updated_at,
          datetime(created_at) as created_at
        FROM database_metadata 
        WHERE is_favorite = 1 
        ORDER BY last_accessed DESC
      `);
      return stmt.all() as DatabaseMetadata[];
    } catch (error) {
      logger.error('Failed to list favorite database metadata:', error);
      return [];
    }
  }
}

export const databaseMetadataModel = new DatabaseMetadataModel(); 