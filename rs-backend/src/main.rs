use std::net::SocketAddr;
use axum::{
    extract::{Path, State},
    response::Json,
    http::{StatusCode, Method},
};
use tower_http::cors::{CorsLayer, Any};
use serde_json::{json, Value};
use dotenv::dotenv;
use std::env;
use tracing::{info, error};
use std::fmt::Display;
use tokio::net::TcpListener;
use multer::Multipart;
use mime::{Mime, APPLICATION_OCTET_STREAM};

use rs_backend::{
    db::connection::DbConnection as DbConnectionAlias,
    models::database_metadata::DatabaseMetadata,
};

#[derive(Debug)]
pub struct ApiError(StatusCode, Json<Value>);

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (self.0, self.1).into_response()
    }
}

// Implement From for rusqlite::Error
impl From<rusqlite::Error> for ApiError {
    fn from(err: rusqlite::Error) -> Self {
        map_db_error(err, "Database error")
    }
}

// Implement From for (StatusCode, Json<Value>)
impl From<(StatusCode, Json<Value>)> for ApiError {
    fn from((status, json): (StatusCode, Json<Value>)) -> Self {
        ApiError(status, json)
    }
}

type ApiResult = Result<Json<Value>, ApiError>;

fn handle_error<E: Display>(e: E, msg: impl Into<String>) -> ApiError {
    let msg = msg.into();
    error!("{}: {}", msg, e);
    ApiError(
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": msg }))
    )
}

fn map_db_error<E: Display>(e: E, msg: impl Into<String>) -> ApiError {
    handle_error(e, msg)
}

#[tokio::main]
async fn main() {
    // Initialize environment
    dotenv().ok();
    
    // Initialize logging
    rs_backend::utils::logger::init_logger();
    info!("Initializing application...");

    // Get port from environment or use default
    let port = env::var("PORT").unwrap_or_else(|_| "3001".to_string()).parse::<u16>().unwrap();
    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    // Initialize database connection
    info!("Initializing database connection...");
    let db_connection = DbConnectionAlias::new();

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers(Any)
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(3600));

    // Create router with routes
    let app = rs_backend::create_app(db_connection).layer(cors);

    // Create TCP listener
    let listener = TcpListener::bind(addr).await.unwrap();
    
    // Log startup completion
    rs_backend::utils::logger::startup_complete(port);
    
    // Start server
    axum::serve(listener, app).await.unwrap();
}

// Route handlers
pub async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

pub async fn list_databases(
    State(db_connection): State<DbConnectionAlias>
) -> ApiResult {
    DatabaseMetadata::list(&db_connection)
        .map(|databases| Json(json!({ "databases": databases })))
        .map_err(|e| map_db_error(e, "Failed to list databases"))
}

pub async fn upload_database(
    State(db_connection): State<DbConnectionAlias>,
    mut multipart: Multipart<'_>,
) -> ApiResult {
    // Process multipart form data
    while let Some(field) = match multipart.next_field().await {
        Ok(field) => field,
        Err(e) => {
            error!("Failed to process multipart form: {}", e);
            return Err(ApiError(
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Failed to process upload" }))
            ));
        }
    } {
        if field.name() == Some("file") {
            let filename = field.file_name().unwrap_or("unknown.db").to_string();
            let content_type = field.content_type();
            
            // Allow both SQLite and generic binary types
            let sqlite_mime: Mime = "application/x-sqlite3".parse().unwrap();
            let is_valid_type = content_type.map_or(true, |mime| {
                mime == &sqlite_mime || mime == &APPLICATION_OCTET_STREAM
            });

            if !is_valid_type {
                return Err(ApiError(
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Invalid file type" }))
                ));
            }

            // Generate unique filename
            let timestamp = chrono::Utc::now().timestamp();
            let unique_filename = format!("{}-{}", timestamp, filename);
            let storage_path = db_connection.get_storage_path("databases").join(&unique_filename);

            // Save file
            let data = match field.bytes().await {
                Ok(data) => data,
                Err(e) => {
                    error!("Failed to read file data: {}", e);
                    return Err(ApiError(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": "Failed to process file" }))
                    ));
                }
            };

            if let Err(e) = tokio::fs::write(&storage_path, &data).await {
                error!("Failed to save file: {}", e);
                return Err(ApiError(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to save file" }))
                ));
            }

            // Count tables
            let pool = db_connection.get_database_pool(&storage_path);
            let conn = pool.get().map_err(|e| map_db_error(e, "Failed to open database"))?;

            let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")
                .map_err(|e| map_db_error(e, "Failed to read database structure"))?;

            let table_count = stmt.query_map([], |_| Ok(()))
                .map_err(|e| map_db_error(e, "Failed to analyze database"))?
                .count() as i32;

            // Create metadata
            let metadata = DatabaseMetadata::new(
                filename,
                storage_path.to_string_lossy().into_owned(),
                data.len() as i64,
                table_count,
                false,
                Some(format!("Uploaded on {}", chrono::Local::now().to_rfc2822())),
            );

            return metadata.save(&db_connection)
                .map(|database| Json(json!({ "database": database })))
                .map_err(|e| map_db_error(e, "Failed to save database metadata"));
        }
    }

    Err(ApiError(
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": "No file provided" }))
    ))
}

pub async fn get_tables(
    State(db_connection): State<DbConnectionAlias>,
    Path(id): Path<i64>,
) -> ApiResult {
    let metadata = match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(m)) => m,
        Ok(None) => return Err(ApiError(
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        )),
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
    State(db_connection): State<DbConnectionAlias>,
    Path((id, table)): Path<(i64, String)>,
) -> ApiResult {
    let metadata = match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(m)) => m,
        Ok(None) => return Err(ApiError(
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        )),
        Err(e) => return Err(map_db_error(e, "Failed to find database")),
    };

    let pool = db_connection.get_database_pool(&metadata.path);
    let conn = pool.get().map_err(|e| map_db_error(e, "Failed to open database"))?;

    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))
        .map_err(|e| map_db_error(e, "Failed to read table schema"))?;

    let schema: Vec<Value> = stmt.query_map([], |row| {
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
    State(db_connection): State<DbConnectionAlias>,
    Path(id): Path<i64>,
    Json(payload): Json<Value>,
) -> ApiResult {
    let sql = match payload.get("sql").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => return Err(ApiError(
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "SQL query is required" }))
        )),
    };

    let metadata = match DatabaseMetadata::find_by_id(&db_connection, id) {
        Ok(Some(m)) => m,
        Ok(None) => return Err(ApiError(
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database not found" }))
        )),
        Err(e) => return Err(map_db_error(e, "Failed to find database")),
    };

    let pool = db_connection.get_database_pool(&metadata.path);
    let conn = pool.get().map_err(|e| map_db_error(e, "Failed to open database"))?;

    let mut stmt = conn.prepare(sql)
        .map_err(|e| map_db_error(e, "Failed to prepare query"))?;

    let columns: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();
    
    // Collect rows with owned values
    let raw_rows: Vec<Vec<rusqlite::types::Value>> = stmt.query_map([], |row| {
        let mut row_data = Vec::with_capacity(columns.len());
        for i in 0..columns.len() {
            // Convert to owned Value type
            let value = match row.get_ref(i)? {
                rusqlite::types::ValueRef::Null => rusqlite::types::Value::Null,
                rusqlite::types::ValueRef::Integer(i) => rusqlite::types::Value::Integer(i),
                rusqlite::types::ValueRef::Real(f) => rusqlite::types::Value::Real(f),
                rusqlite::types::ValueRef::Text(t) => rusqlite::types::Value::Text(String::from_utf8_lossy(t).into_owned()),
                rusqlite::types::ValueRef::Blob(b) => rusqlite::types::Value::Blob(b.to_vec()),
            };
            row_data.push(value);
        }
        Ok(row_data)
    })?.collect::<Result<_, _>>()
    .map_err(|e| map_db_error(e, "Failed to collect results"))?;

    // Process rows in parallel
    use rayon::prelude::*;
    let rows: Vec<Value> = raw_rows.par_iter()
        .map(|row_data| {
            let mut obj = serde_json::Map::new();
            for (i, column) in columns.iter().enumerate() {
                let value = match &row_data[i] {
                    rusqlite::types::Value::Null => Value::Null,
                    rusqlite::types::Value::Integer(i) => Value::Number((*i).into()),
                    rusqlite::types::Value::Real(f) => Value::Number(
                        serde_json::Number::from_f64(*f).unwrap_or_else(|| serde_json::Number::from(0))
                    ),
                    rusqlite::types::Value::Text(s) => Value::String(s.clone()),
                    rusqlite::types::Value::Blob(b) => Value::String(format!("<Binary data: {} bytes>", b.len())),
                };
                obj.insert(column.clone(), value);
            }
            Value::Object(obj)
        })
        .collect();

    Ok(Json(json!({ "rows": rows })))
} 