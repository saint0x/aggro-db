-- Enable foreign key support and WAL mode for better concurrency
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Database metadata
CREATE TABLE IF NOT EXISTS database_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  size INTEGER NOT NULL,
  table_count INTEGER NOT NULL,
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_favorite BOOLEAN DEFAULT 0,
  notes TEXT,
  schema_cache TEXT,
  schema_updated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Database tables
CREATE TABLE IF NOT EXISTS database_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  database_id INTEGER NOT NULL,
  table_name TEXT NOT NULL,
  column_count INTEGER NOT NULL,
  row_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (database_id) REFERENCES database_metadata(id) ON DELETE CASCADE
);

-- Database columns
CREATE TABLE IF NOT EXISTS database_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  nullable BOOLEAN NOT NULL,
  primary_key BOOLEAN NOT NULL,
  default_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES database_tables(id) ON DELETE CASCADE
);

-- Query history
CREATE TABLE IF NOT EXISTS query_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  database_name TEXT NOT NULL,
  database_path TEXT NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  results_path TEXT,
  favorite BOOLEAN DEFAULT 0
);

-- Saved queries
CREATE TABLE IF NOT EXISTS saved_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  database_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tags TEXT,
  favorite BOOLEAN DEFAULT 0
);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_database_metadata_path ON database_metadata(path);
CREATE INDEX IF NOT EXISTS idx_database_tables_database_id ON database_tables(database_id);
CREATE INDEX IF NOT EXISTS idx_database_columns_table_id ON database_columns(table_id);
CREATE INDEX IF NOT EXISTS idx_query_history_database_path ON query_history(database_path);
CREATE INDEX IF NOT EXISTS idx_saved_queries_database_path ON saved_queries(database_path);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key); 