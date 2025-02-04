use crate::common::TestEnv;
use rs_backend::db::connection::DbConnection;

#[test]
fn test_new_connection() {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let pool = db_connection.get_metadata_pool();
    assert!(pool.get().is_ok());
    test_env.cleanup();
}

#[test]
fn test_get_metadata_pool() {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let pool = db_connection.get_metadata_pool();
    assert!(pool.get().is_ok());
    test_env.cleanup();
}

#[test]
fn test_get_storage_path() {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let storage_path = db_connection.get_storage_path("test");
    assert!(storage_path.starts_with(&test_env.test_dir));
    assert!(storage_path.ends_with("test"));
    test_env.cleanup();
}

#[test]
fn test_get_database_pool() {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let db_path = test_env.test_dir.join("test.db");
    let pool = db_connection.get_database_pool(&db_path);
    assert!(pool.get().is_ok());
    test_env.cleanup();
}

#[test]
fn test_connection() {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let pool = db_connection.get_metadata_pool();
    let conn = pool.get().unwrap();
    assert!(conn.is_autocommit());
    test_env.cleanup();
}

#[test]
fn test_connection_cleanup() {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let pool = db_connection.get_metadata_pool();
    {
        let conn = pool.get().unwrap();
        assert!(conn.is_autocommit());
    }
    // Connection should be returned to pool here
    let conn = pool.get().unwrap();
    assert!(conn.is_autocommit());
    test_env.cleanup();
}

#[test]
fn test_concurrent_connections() {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let pool = db_connection.get_metadata_pool();
    
    let mut handles = vec![];
    
    for _ in 0..5 {
        let pool = pool.clone();
        let handle = std::thread::spawn(move || {
            let conn = pool.get().unwrap();
            assert!(conn.is_autocommit());
        });
        handles.push(handle);
    }
    
    for handle in handles {
        handle.join().unwrap();
    }
    test_env.cleanup();
} 