use std::path::PathBuf;
use std::sync::Once;
use tracing_subscriber::{self, fmt::format::FmtSpan};
use rusqlite::Connection;
use std::time::{SystemTime, UNIX_EPOCH};
use std::fs;
use std::thread;
use std::time::Duration;

static INIT: Once = Once::new();

pub fn init_test_logging() {
    INIT.call_once(|| {
        tracing_subscriber::fmt()
            .with_span_events(FmtSpan::CLOSE)
            .with_thread_ids(true)
            .with_thread_names(true)
            .with_file(true)
            .with_line_number(true)
            .with_target(false)
            .init();
    });
}

fn generate_test_dir() -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    PathBuf::from(format!("tests/data_{}", timestamp))
}

pub struct TestEnv {
    pub test_dir: PathBuf,
}

impl TestEnv {
    pub fn new() -> Self {
        init_test_logging();
        
        let test_dir = generate_test_dir();
        
        // Clean up any existing test directory
        if test_dir.exists() {
            let _ = fs::remove_dir_all(&test_dir);
            // Wait a bit to ensure the directory is fully removed
            thread::sleep(Duration::from_millis(100));
        }
        
        // Create test directory with proper permissions
        fs::create_dir_all(&test_dir)
            .expect("Failed to create test data directory");
        
        // Create databases subdirectory
        let db_dir = test_dir.join("databases");
        fs::create_dir_all(&db_dir)
            .expect("Failed to create databases directory");
        
        // Create metadata directory
        let metadata_dir = test_dir.join("metadata");
        fs::create_dir_all(&metadata_dir)
            .expect("Failed to create metadata directory");
        
        // Set the storage path to our test directory
        std::env::set_var("SQLITE_STORAGE_PATH", test_dir.to_str().unwrap());
        
        TestEnv { test_dir }
    }
    
    pub fn create_test_db(&self) -> PathBuf {
        let db_path = self.test_dir.join("databases").join("test.db");
        
        // Remove existing database if it exists
        if db_path.exists() {
            for _ in 0..3 {
                if fs::remove_file(&db_path).is_ok() {
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
        }
        
        // Ensure parent directory exists with proper permissions
        let parent = db_path.parent().unwrap();
        fs::create_dir_all(parent)
            .expect("Failed to create database directory");
        
        // Set directory permissions to 755 (rwxr-xr-x)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(parent, fs::Permissions::from_mode(0o755))
                .expect("Failed to set directory permissions");
        }
        
        // Wait a bit to ensure the directory is ready
        thread::sleep(Duration::from_millis(200));
        
        // Create a simple SQLite database with test tables
        let conn = Connection::open(&db_path)
            .expect("Failed to create test database");
            
        // Set file permissions to 644 (rw-r--r--)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&db_path, fs::Permissions::from_mode(0o644))
                .expect("Failed to set database file permissions");
        }
        
        // Create test tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS test1 (id INTEGER PRIMARY KEY, name TEXT)",
            [],
        ).expect("Failed to create test table 1");
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS test2 (id INTEGER PRIMARY KEY, value INTEGER)",
            [],
        ).expect("Failed to create test table 2");
        
        // Insert some test data
        conn.execute(
            "INSERT INTO test1 (name) VALUES (?1), (?2)",
            ["Test 1", "Test 2"],
        ).expect("Failed to insert test data into table 1");
        
        conn.execute(
            "INSERT INTO test2 (value) VALUES (?1), (?2)",
            [42_i32, 84_i32],
        ).expect("Failed to insert test data into table 2");
        
        // Ensure all changes are written and connection is closed properly
        conn.pragma_update(None, "wal_checkpoint", "TRUNCATE")
            .expect("Failed to checkpoint database");
        conn.close().expect("Failed to close database connection");
        
        // Wait a bit to ensure all writes are flushed
        thread::sleep(Duration::from_millis(200));
        
        // Verify the database exists and is readable
        assert!(db_path.exists(), "Database file was not created");
        let conn = Connection::open(&db_path)
            .expect("Failed to open test database for verification");
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .expect("Failed to prepare verification query");
        let tables: Vec<String> = stmt.query_map([], |row| row.get(0))
            .expect("Failed to execute verification query")
            .collect::<Result<_, _>>()
            .expect("Failed to collect verification results");
        assert!(tables.contains(&"test1".to_string()), "test1 table not found");
        assert!(tables.contains(&"test2".to_string()), "test2 table not found");
        
        db_path
    }
    
    pub fn create_metadata_db(&self) -> PathBuf {
        let db_path = self.test_dir.join("metadata").join("metadata.db");
        
        // Remove existing database if it exists
        if db_path.exists() {
            for _ in 0..3 {
                if fs::remove_file(&db_path).is_ok() {
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
        }
        
        // Ensure parent directory exists with proper permissions
        let parent = db_path.parent().unwrap();
        if !parent.exists() {
            fs::create_dir_all(parent)
                .expect("Failed to create metadata directory");
        }
        
        // Wait a bit to ensure the directory is ready
        thread::sleep(Duration::from_millis(100));
        
        // Create metadata database
        let conn = Connection::open(&db_path)
            .expect("Failed to create metadata database");
        
        // Create metadata table
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
        
        // Ensure all changes are written and connection is closed
        conn.close().expect("Failed to close database connection");
        
        // Wait a bit to ensure all writes are flushed
        thread::sleep(Duration::from_millis(100));
        
        db_path
    }
    
    pub fn cleanup(&self) {
        // Remove the test directory and all its contents
        if self.test_dir.exists() {
            // Try multiple times to remove the directory
            for _ in 0..5 {
                if fs::remove_dir_all(&self.test_dir).is_ok() {
                    break;
                }
                thread::sleep(Duration::from_millis(200));
            }
        }
    }
}

impl Drop for TestEnv {
    fn drop(&mut self) {
        self.cleanup();
    }
} 