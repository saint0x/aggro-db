use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use r2d2_sqlite::SqliteConnectionManager;
use serde_json::{json, Value};
use std::path::PathBuf;
use rusqlite;
use std::convert::Infallible;

#[derive(Clone)]
pub struct DbConnection(pub r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>);

pub type ApiResult<T> = Result<T, (StatusCode, Json<Value>)>;

fn map_db_error<E: std::error::Error>(err: E) -> (StatusCode, Json<Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({
            "error": format!("Database error: {}", err)
        })),
    )
}

fn map_rusqlite_error(err: rusqlite::Error) -> (StatusCode, Json<Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({
            "error": format!("SQLite error: {}", err)
        })),
    )
}

#[axum::debug_handler]
pub async fn health_check() -> &'static str {
    "OK"
}

#[axum::debug_handler]
pub async fn list_databases(State(db): State<DbConnection>) -> ApiResult<Json<Value>> {
    let conn = db.get().map_err(map_db_error)?;
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .map_err(map_db_error)?;
    
    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(map_db_error)?
        .collect::<Result<_, _>>()
        .map_err(map_db_error)?;

    Ok(Json(json!({ "tables": tables })))
}

#[axum::debug_handler]
pub async fn create_test_database(State(db): State<DbConnection>) -> ApiResult<Json<Value>> {
    let conn = db.get().map_err(map_db_error)?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL
        )",
        [],
    )
    .map_err(map_db_error)?;

    conn.execute(
        "INSERT OR IGNORE INTO users (name, email) VALUES 
        ('Alice', 'alice@example.com'),
        ('Bob', 'bob@example.com')",
        [],
    )
    .map_err(map_db_error)?;

    Ok(Json(json!({ "message": "Test database created successfully" })))
}

#[axum::debug_handler]
pub async fn upload_database<'a>(
    State(db): State<DbConnection>,
    mut multipart: Multipart<'a>,
) -> ApiResult<Json<Value>> {
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Failed to process multipart form: {}", e)})),
        )
    })? {
        let content_type = field.content_type().unwrap_or("").to_string();
        if !content_type.contains("application/x-sqlite3") {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid file type. Expected SQLite database"})),
            ));
        }

        let data = field.bytes().await.map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to read file: {}", e)})),
            )
        })?;

        // Process the SQLite database file
        let temp_dir = tempfile::tempdir().map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to create temp directory: {}", e)})),
            )
        })?;
        let db_path = temp_dir.path().join("uploaded.db");
        std::fs::write(&db_path, &data).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to write database file: {}", e)})),
            )
        })?;

        // Verify the database is valid
        let manager = SqliteConnectionManager::file(&db_path);
        let pool = r2d2::Pool::new(manager).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to create connection pool: {}", e)})),
            )
        })?;

        let conn = pool.get().map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to connect to database: {}", e)})),
            )
        })?;

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to query database: {}", e)})),
                )
            })?;

        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to read tables: {}", e)})),
                )
            })?
            .collect::<Result<_, _>>()
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("Failed to collect tables: {}", e)})),
                )
            })?;

        return Ok(Json(json!({
            "message": "Database uploaded successfully",
            "tables": tables
        })));
    }

    Err((
        StatusCode::BAD_REQUEST,
        Json(json!({"error": "No file provided"})),
    ))
}

#[axum::debug_handler]
pub async fn get_tables(
    State(db): State<DbConnection>,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    let conn = db.get().map_err(map_db_error)?;
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .map_err(map_db_error)?;
    
    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(map_db_error)?
        .collect::<Result<_, _>>()
        .map_err(map_db_error)?;

    Ok(Json(json!({ "tables": tables })))
}

#[axum::debug_handler]
pub async fn get_table_schema(
    State(db): State<DbConnection>,
    Path((id, table)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let conn = db.get().map_err(map_db_error)?;
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table))
        .map_err(map_db_error)?;
    
    let columns: Vec<Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "name": row.get::<_, String>(1)?,
                "type": row.get::<_, String>(2)?,
                "notnull": row.get::<_, bool>(3)?,
                "pk": row.get::<_, bool>(5)?
            }))
        })
        .map_err(map_db_error)?
        .collect::<Result<_, _>>()
        .map_err(map_db_error)?;

    Ok(Json(json!({ "columns": columns })))
}

#[axum::debug_handler]
pub async fn execute_query(
    State(db): State<DbConnection>,
    Path(id): Path<String>,
    Json(payload): Json<Value>,
) -> ApiResult<Json<Value>> {
    let query = payload["query"]
        .as_str()
        .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "Missing query"}))))?;

    let conn = db.get().map_err(map_db_error)?;
    let mut stmt = conn.prepare(query).map_err(map_db_error)?;
    let column_names: Vec<String> = stmt
        .column_names()
        .into_iter()
        .map(|s| s.to_string())
        .collect();

    let mut results = Vec::new();
    let rows = stmt
        .query_map([], |row| {
            let mut map = serde_json::Map::new();
            for (i, col_name) in column_names.iter().enumerate() {
                let value: rusqlite::types::Value = row.get(i).map_err(|e| rusqlite::Error::from(e))?;
                let json_value = match value {
                    rusqlite::types::Value::Null => Value::Null,
                    rusqlite::types::Value::Integer(i) => Value::Number(i.into()),
                    rusqlite::types::Value::Real(f) => {
                        Value::Number(serde_json::Number::from_f64(f).unwrap_or_default())
                    }
                    rusqlite::types::Value::Text(s) => Value::String(s),
                    rusqlite::types::Value::Blob(b) => Value::String(format!("<blob: {} bytes>", b.len())),
                };
                map.insert(col_name.clone(), json_value);
            }
            Ok(Value::Object(map))
        })
        .map_err(map_db_error)?;

    for row in rows {
        results.push(row.map_err(map_db_error)?);
    }

    Ok(Json(json!({
        "columns": column_names,
        "rows": results
    })))
}

pub fn create_app(db_connection: DbConnection) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/databases", get(list_databases))
        .route("/databases/test", post(create_test_database))
        .route("/databases/upload", post(upload_database))
        .route("/databases/:id/tables", get(get_tables))
        .route("/databases/:id/tables/:table/schema", get(get_table_schema))
        .route("/databases/:id/query", post(execute_query))
        .with_state(db_connection)
} 
