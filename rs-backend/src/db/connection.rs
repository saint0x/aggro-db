use std::path::{Path, PathBuf};
use std::env;
use r2d2_sqlite::SqliteConnectionManager;
use r2d2::Pool;

#[derive(Clone)]
pub struct DbConnection {
    storage_path: PathBuf,
    metadata_pool: Pool<SqliteConnectionManager>,
}

impl DbConnection {
    pub fn new() -> Self {
        let storage_path = env::var("SQLITE_STORAGE_PATH")
            .unwrap_or_else(|_| "storage".to_string());
        
        // Create storage directory if it doesn't exist
        std::fs::create_dir_all(&storage_path).expect("Failed to create storage directory");

        // Initialize metadata database pool
        let metadata_db_path = PathBuf::from(&storage_path).join("metadata.db");
        let manager = SqliteConnectionManager::file(&metadata_db_path);
        let metadata_pool = Pool::new(manager).expect("Failed to create connection pool");

        // Initialize metadata database schema
        let conn = metadata_pool.get().expect("Failed to get connection from pool");
        conn.execute(
            "CREATE TABLE IF NOT EXISTS database_metadata (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                size INTEGER NOT NULL,
                table_count INTEGER NOT NULL,
                is_favorite BOOLEAN NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        ).expect("Failed to create metadata table");

        Self {
            storage_path: PathBuf::from(storage_path),
            metadata_pool,
        }
    }

    pub fn get_storage_path(&self, path: impl AsRef<Path>) -> PathBuf {
        let full_path = self.storage_path.join(path);
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).expect("Failed to create storage directory");
            }
        }
        full_path
    }

    pub fn get_metadata_pool(&self) -> &Pool<SqliteConnectionManager> {
        &self.metadata_pool
    }

    pub fn get_database_pool(&self, path: impl AsRef<Path>) -> Pool<SqliteConnectionManager> {
        let manager = SqliteConnectionManager::file(path.as_ref());
        Pool::new(manager).expect("Failed to create database pool")
    }

    #[allow(dead_code)]
    pub fn open_database(&self, path: impl AsRef<Path>) -> rusqlite::Result<rusqlite::Connection> {
        rusqlite::Connection::open(path.as_ref())
    }
} 