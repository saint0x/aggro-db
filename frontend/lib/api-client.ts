// Default to development URL if not provided
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Log the API URL for debugging
console.log('API URL:', API_URL)

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
}

export interface TableSchema {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface QueryResult {
  results?: any[];
  changes?: number;
  lastInsertId?: number;
  error?: string;
  details?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  // Database operations
  async listDatabases(): Promise<DatabaseMetadata[]> {
    const response = await fetch(`${this.baseUrl}/databases`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch databases');
    }

    const data = await response.json();
    return data.databases;
  }

  async createTestDatabase(): Promise<DatabaseMetadata> {
    const response = await fetch(`${this.baseUrl}/databases/test`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to create test database');
    }

    const data = await response.json();
    return data.database;
  }

  async uploadDatabase(file: File): Promise<DatabaseMetadata> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/databases/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload database');
    }

    const data = await response.json();
    if (!data.database) {
      throw new Error('Invalid response format');
    }
    return data.database;
  }

  async getTables(databaseId: number): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/databases/${databaseId}/tables`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch tables');
    }

    const data = await response.json();
    return data.tables;
  }

  async getTableSchema(databaseId: number, table: string): Promise<TableSchema[]> {
    const response = await fetch(`${this.baseUrl}/databases/${databaseId}/tables/${table}/schema`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch schema for table ${table}`);
    }

    const data = await response.json();
    return data.schema;
  }

  // Query operations
  async executeQuery(databaseId: number, sql: string): Promise<QueryResult> {
    const response = await fetch(`${this.baseUrl}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to execute query');
    }

    return response.json();
  }

  // Health check
  async checkHealth(): Promise<{ status: string, timestamp: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    
    if (!response.ok) {
      throw new Error('Health check failed');
    }

    return response.json();
  }
}

// Export a singleton instance
export const apiClient = new ApiClient(); 