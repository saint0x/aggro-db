pub mod db;
pub mod models;
pub mod utils;

use axum::{
    Router,
    routing::{get, post, delete, put},
    extract::{Path, State, Multipart},
    response::Json,
    http::StatusCode,
};
use serde_json::{json, Value};
use tracing::error;
use std::fmt::Display;

use db::connection::DbConnection;
use models::database_metadata::DatabaseMetadata;

// Constants for file upload limits
const MAX_FILE_SIZE: usize = 1024 * 1024 * 100; // 100MB
const MIN_FILE_SIZE: usize = 1024; // 1KB

// Define our own error type that wraps the StatusCode and Json response
#[derive(Debug)]
pub struct ApiError(StatusCode, Json<Value>);

// Implement conversion from ApiError to Response
impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (self.0, self.1).into_response()
    }
}

// Implement From for the tuple type
impl From<(StatusCode, Json<Value>)> for ApiError {
    fn from((status, json): (StatusCode, Json<Value>)) -> Self {
        ApiError(status, json)
    }
}

// Now we can implement From for rusqlite::Error
impl From<rusqlite::Error> for ApiError {
    fn from(err: rusqlite::Error) -> Self {
        match err {
            rusqlite::Error::SqliteFailure(_, Some(msg)) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": msg }))
            ).into(),
            _ => map_db_error(err, "Database error")
        }
    }
}

type ApiResult = Result<Json<Value>, ApiError>;

fn handle_error<E: Display>(e: E, msg: impl Into<String>) -> ApiError {
    let msg = msg.into();
    error!("{}: {}", msg, e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": msg }))
    ).into()
}

fn map_db_error<E: Display>(e: E, msg: impl Into<String>) -> ApiError {
    handle_error(e, msg)
}

pub fn create_app(db_connection: DbConnection) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/databases", get(list_databases))
        .route("/databases/upload", post(upload_database))
        .route("/databases/:id/tables", get(get_tables))
        .route("/databases/:id/tables/:table/schema", get(get_table_schema))
        .route("/databases/:id/query", post(execute_query))
        .route("/databases/:id", get(get_database))
        .route("/databases/:id", delete(delete_database))
        .route("/databases/:id", put(update_database))
        .with_state(db_connection)
}

// Route handlers
pub async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

pub async fn list_databases(
    State(db_connection): State<DbConnection>
) -> ApiResult {
    DatabaseMetadata::list(&db_connection)
        .map(|databases| Json(json!({ "databases": databases })))
        .map_err(|e| map_db_error(e, "Failed to list databases"))
}

#[axum::debug_handler]
pub async fn upload_database(
    State(db_connection): State<DbConnection>,
    mut multipart: Multipart,
) -> ApiResult {
    // Process multipart form data
    let (filename, content_type, file_data) = match process_multipart(&mut multipart).await {
        Ok(data) => data,
        Err(e) => return Err(e),
    };
    
    // Validate file type
    if !content_type.starts_with("application/x-sqlite3") && !content_type.starts_with("application/octet-stream") {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid file type. Only SQLite databases are allowed." }))
        ).into());
    }

    // Check file size
    let total_size = file_data.len();
    if total_size > MAX_FILE_SIZE {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("File too large. Maximum size is {}MB", MAX_FILE_SIZE / 1024 / 1024) }))
        ).into());
    }
    if total_size < MIN_FILE_SIZE {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("File too small. Minimum size is {}KB", MIN_FILE_SIZE / 1024) }))
        ).into());
    }

    // Generate unique filename and path
    let timestamp = chrono::Utc::now().timestamp();
    let unique_filename = format!("{}-{}", timestamp, filename);
    let storage_path = db_connection.get_storage_path("databases").join(&unique_filename);

    // Ensure parent directory exists
    if let Some(parent) = storage_path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            error!("Failed to create directory: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to create directory" }))
            ).into());
        }
    }

    // Write file
    if let Err(e) = tokio::fs::write(&storage_path, &file_data).await {
        error!("Failed to write file: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to save file" }))
        ).into());
    }

    // Validate SQLite database and count tables
    let table_count = match validate_sqlite_db(&storage_path) {
        Ok(count) => count,
        Err(e) => {
            tokio::fs::remove_file(&storage_path).await.ok();
            return Err(e);
        }
    };

    // Create metadata
    let metadata = DatabaseMetadata::new(
        filename,
        storage_path.to_string_lossy().into_owned(),
        total_size as i64,
        table_count,
        false,
        Some(format!("Uploaded on {}", chrono::Local::now().to_rfc2822())),
    );

    metadata.save(&db_connection)
        .map(|database| Json(json!({ "database": database })))
        .map_err(|e| map_db_error(e, "Failed to save database metadata"))
}

// Helper function to process multipart form data
async fn process_multipart(multipart: &mut Multipart) -> Result<(String, String, Vec<u8>), ApiError> {
    let field = match multipart.next_field().await {
        Ok(Some(field)) => field,
        Ok(None) => {
            return Err(ApiError(
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "No file provided" }))
            ));
        }
        Err(e) => {
            error!("Failed to process multipart form: {}", e);
            return Err(ApiError(
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Failed to process upload" }))
            ));
        }
    };

    if field.name() != Some("file") {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "No file provided" }))
        ));
    }

    let filename = field.file_name().unwrap_or("unknown.db").to_string();
    let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
    
    let data = match field.bytes().await {
        Ok(data) => data,
        Err(e) => {
            error!("Failed to read file data: {}", e);
            return Err(ApiError(
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to read file data" }))
            ));
        }
    };
    
    Ok((filename, content_type, data.to_vec()))
}

// Helper function to validate SQLite database and count tables
fn validate_sqlite_db(path: &std::path::Path) -> Result<i32, ApiError> {
    let conn = rusqlite::Connection::open(path)
        .map_err(|_| ApiError(
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Failed to read database structure" }))
        ))?;

    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .map_err(|_| ApiError(
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Failed to read database structure" }))
        ))?;

    let table_count = stmt.query_map([], |_| Ok(()))
        .map_err(|_| ApiError(
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Failed to read database structure" }))
        ))?
        .count() as i32;

    Ok(table_count)
}

pub async fn get_tables(
    State(db_connection): State<DbConnection>,
    Path(id): Path<i64>,
) -> ApiResult {
    let metadata = match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(m)) => m,
        Ok(None) => return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        ).into()),
        Err(e) => return Err(map_db_error(e, "Failed to find database")),
    };

    let pool = db_connection.get_database_pool(&metadata.path);
    let conn = pool.get().map_err(|e| map_db_error(e, "Failed to open database"))?;

    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .map_err(|e| map_db_error(e, "Failed to read database structure"))?;

    let tables: Result<Vec<String>, _> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| map_db_error(e, "Failed to read tables"))?
        .collect::<Result<_, _>>()
        .map_err(|e| map_db_error(e, "Failed to collect tables"));

    Ok(Json(json!({ "tables": tables? })))
}

pub async fn get_table_schema(
    State(db_connection): State<DbConnection>,
    Path((id, table)): Path<(i64, String)>,
) -> ApiResult {
    let metadata = match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(m)) => m,
        Ok(None) => return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        ).into()),
        Err(e) => return Err(map_db_error(e, "Failed to find database")),
    };

    let pool = db_connection.get_database_pool(&metadata.path);
    let conn = pool.get().map_err(|e| map_db_error(e, "Failed to open database"))?;

    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))
        .map_err(|e| map_db_error(e, "Failed to read table schema"))?;

    let schema: Vec<Value> = stmt.query_map([], |row| -> rusqlite::Result<Value> {
        Ok(json!({
            "cid": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "type": row.get::<_, String>(2)?,
            "notnull": row.get::<_, bool>(3)?,
            "dflt_value": row.get::<_, Option<String>>(4)?,
            "pk": row.get::<_, bool>(5)?
        }))
    })
    .map_err(|e| map_db_error(e, "Failed to read schema"))?
    .collect::<Result<_, _>>()
    .map_err(|e| map_db_error(e, "Failed to collect schema"))?;

    Ok(Json(json!({ "schema": schema })))
}

pub async fn execute_query(
    State(db_connection): State<DbConnection>,
    Path(id): Path<i64>,
    Json(payload): Json<Value>,
) -> ApiResult {
    let sql = match payload.get("sql").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "SQL query is required" }))
        ).into()),
    };

    let metadata = match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(m)) => m,
        Ok(None) => return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        ).into()),
        Err(e) => return Err(map_db_error(e, "Failed to find database")),
    };

    let pool = db_connection.get_database_pool(&metadata.path);
    let conn = pool.get().map_err(|e| map_db_error(e, "Failed to open database"))?;

    let mut stmt = match conn.prepare(sql) {
        Ok(stmt) => stmt,
        Err(e) => return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to prepare query: {}", e) }))
        ).into()),
    };

    let columns: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();
    
    // Collect rows first
    let raw_rows: Vec<Vec<Value>> = stmt.query_map([], |row| -> rusqlite::Result<Vec<Value>> {
        let mut row_data = Vec::with_capacity(columns.len());
        for i in 0..columns.len() {
            let value = match row.get_ref(i)? {
                rusqlite::types::ValueRef::Null => Value::Null,
                rusqlite::types::ValueRef::Integer(i) => json!(i),
                rusqlite::types::ValueRef::Real(f) => json!(f),
                rusqlite::types::ValueRef::Text(s) => json!(s),
                rusqlite::types::ValueRef::Blob(b) => json!(format!("<BLOB: {} bytes>", b.len())),
            };
            row_data.push(value);
        }
        Ok(row_data)
    })
    .map_err(|e| map_db_error(e, "Failed to execute query"))?
    .collect::<Result<_, _>>()
    .map_err(|e| map_db_error(e, "Failed to collect results"))?;

    // Process rows in parallel
    use rayon::prelude::*;
    let rows: Vec<Value> = raw_rows.par_iter()
        .map(|row_data| {
            let mut obj = serde_json::Map::new();
            for (i, column) in columns.iter().enumerate() {
                obj.insert(column.clone(), row_data[i].clone());
            }
            Value::Object(obj)
        })
        .collect();

    Ok(Json(json!({ "rows": rows })))
}

pub async fn get_database(
    State(db_connection): State<DbConnection>,
    Path(id): Path<i64>,
) -> ApiResult {
    match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(database)) => Ok(Json(json!({ "database": database }))),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        ).into()),
        Err(e) => Err(map_db_error(e, "Failed to find database")),
    }
}

#[axum::debug_handler]
pub async fn delete_database(
    State(db_connection): State<DbConnection>,
    Path(id): Path<i64>,
) -> ApiResult {
    // Find the database metadata
    let metadata = match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(m)) => m,
        Ok(None) => return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        ).into()),
        Err(e) => return Err(map_db_error(e, "Failed to find database")),
    };

    // Delete the database file
    if let Err(e) = tokio::fs::remove_file(&metadata.path).await {
        error!("Failed to delete database file: {}", e);
        // Continue with metadata deletion even if file deletion fails
    }

    // Delete the metadata
    match DatabaseMetadata::delete(&db_connection, id) {
        Ok(_) => Ok(Json(json!({ "message": "Database deleted successfully" }))),
        Err(e) => Err(map_db_error(e, "Failed to delete database metadata")),
    }
}

#[axum::debug_handler]
pub async fn update_database(
    State(db_connection): State<DbConnection>,
    Path(id): Path<i64>,
    Json(payload): Json<Value>,
) -> ApiResult {
    // Find the database metadata
    let mut metadata = match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(m)) => m,
        Ok(None) => return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        ).into()),
        Err(e) => return Err(map_db_error(e, "Failed to find database")),
    };

    // Update fields
    if let Some(name) = payload.get("name").and_then(|v| v.as_str()) {
        metadata.name = name.to_string();
    }

    if let Some(notes) = payload.get("notes").and_then(|v| v.as_str()) {
        metadata.notes = Some(notes.to_string());
    }

    if let Some(is_favorite) = payload.get("is_favorite").and_then(|v| v.as_bool()) {
        metadata.is_favorite = is_favorite;
    }

    // Update timestamp
    metadata.updated_at = Some(chrono::Utc::now());

    // Save changes
    match metadata.save(&db_connection) {
        Ok(updated) => Ok(Json(json!({ "database": updated }))),
        Err(e) => Err(map_db_error(e, "Failed to update database")),
    }
} 