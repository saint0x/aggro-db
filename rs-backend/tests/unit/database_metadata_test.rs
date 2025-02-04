use rs_backend::db::connection::DbConnection;
use rs_backend::models::database_metadata::DatabaseMetadata;
use crate::common::TestEnv;

fn setup() -> (DbConnection, String, TestEnv) {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let db_path = test_env.create_test_db();
    
    (db_connection, db_path.to_string_lossy().into_owned(), test_env)
}

#[test]
fn test_database_metadata() {
    let (_db_connection, db_path, test_env) = setup();
    
    let metadata = DatabaseMetadata::new(
        "Test DB".to_string(),
        db_path,
        1000,
        2,
        false,
        Some("Test notes".to_string()),
    );
    
    assert_eq!(metadata.name, "Test DB");
    assert_eq!(metadata.table_count, 2);
    assert_eq!(metadata.is_favorite, false);
    assert_eq!(metadata.notes, Some("Test notes".to_string()));
    
    test_env.cleanup();
}

#[test]
fn test_save_and_find_database_metadata() {
    let (db_connection, db_path, test_env) = setup();
    
    let metadata = DatabaseMetadata::new(
        "Test DB".to_string(),
        db_path,
        1000,
        2,
        false,
        Some("Test notes".to_string()),
    );
    
    let saved = metadata.save(&db_connection).unwrap();
    assert!(saved.id.is_some());
    
    let found = DatabaseMetadata::find_by_id(&db_connection, saved.id.expect("ID should be present")).unwrap();
    assert!(found.is_some());
    let found = found.unwrap();
    
    assert_eq!(found.name, "Test DB");
    assert_eq!(found.table_count, 2);
    assert_eq!(found.is_favorite, false);
    assert_eq!(found.notes, Some("Test notes".to_string()));
    
    test_env.cleanup();
}

#[test]
fn test_find_nonexistent_metadata() {
    let (db_connection, _, test_env) = setup();
    
    let result = DatabaseMetadata::find_by_id(&db_connection, 9999).unwrap();
    assert!(result.is_none());
    
    test_env.cleanup();
}

#[test]
fn test_list_database_metadata() {
    let (db_connection, db_path, test_env) = setup();
    
    // Create and save multiple metadata entries
    for i in 1..=3 {
        let metadata = DatabaseMetadata::new(
            format!("Test DB {}", i),
            db_path.clone(),
            1000,
            2,
            false,
            Some(format!("Test notes {}", i)),
        );
        metadata.save(&db_connection).unwrap();
    }
    
    let list = DatabaseMetadata::list(&db_connection).unwrap();
    assert_eq!(list.len(), 3);
    
    test_env.cleanup();
}

#[test]
fn test_update_database_metadata() {
    let (db_connection, db_path, test_env) = setup();
    
    let metadata = DatabaseMetadata::new(
        "Test DB".to_string(),
        db_path,
        1000,
        2,
        false,
        Some("Test notes".to_string()),
    );
    
    let mut saved = metadata.save(&db_connection).unwrap();
    
    // Update some fields
    saved.name = "Updated DB".to_string();
    saved.is_favorite = true;
    saved.notes = Some("Updated notes".to_string());
    
    let updated = saved.save(&db_connection).unwrap();
    
    assert_eq!(updated.name, "Updated DB");
    assert_eq!(updated.is_favorite, true);
    assert_eq!(updated.notes, Some("Updated notes".to_string()));
    
    // Verify the update was persisted
    let found = DatabaseMetadata::find_by_id(&db_connection, updated.id.expect("ID should be present")).unwrap().unwrap();
    assert_eq!(found.name, "Updated DB");
    assert_eq!(found.is_favorite, true);
    assert_eq!(found.notes, Some("Updated notes".to_string()));
    
    test_env.cleanup();
} 