use axum::{
    body::{Body, Bytes},
    http::{Request, StatusCode},
};
use serde_json::Value;
use tower::ServiceExt;
use rs_backend::db::connection::DbConnection;
use crate::common::TestEnv;

async fn setup_test_app() -> (axum::Router, TestEnv) {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let app = rs_backend::create_app(db_connection);
    (app, test_env)
}

// Helper function to convert response body to bytes
async fn read_response_body(response: axum::response::Response) -> Result<Bytes, String> {
    axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .map_err(|e| e.to_string())
}

#[tokio::test]
async fn test_upload_invalid_file_type() {
    let (app, test_env) = setup_test_app().await;
    
    // Create multipart form data with wrong content type
    let boundary = "test_boundary";
    let body = format!(
        "--{boundary}\r\n\
         Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\n\
         Content-Type: text/plain\r\n\r\n\
         This is not a SQLite database\r\n\
         --{boundary}--\r\n"
    );
    
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/databases/upload")
                .header("content-type", format!("multipart/form-data; boundary={}", boundary))
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    
    let body = read_response_body(response).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["error"], "Invalid file type. Only SQLite databases are allowed.");
    
    test_env.cleanup();
}

#[tokio::test]
async fn test_upload_no_file() {
    let (app, test_env) = setup_test_app().await;
    
    // Create empty multipart form data
    let boundary = "test_boundary";
    let body = format!(
        "--{boundary}\r\n\
         Content-Disposition: form-data; name=\"empty\"\r\n\r\n\
         nothing\r\n\
         --{boundary}--\r\n"
    );
    
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/databases/upload")
                .header("content-type", format!("multipart/form-data; boundary={}", boundary))
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    
    let body = read_response_body(response).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["error"], "No file provided");
    
    test_env.cleanup();
}

#[tokio::test]
async fn test_upload_corrupted_database() {
    let (app, test_env) = setup_test_app().await;
    
    // Create a corrupted database file (larger than minimum size)
    let mut corrupted_data = vec![0u8; 2048]; // 2KB
    // Add SQLite header to make it look like a database file
    corrupted_data[0..16].copy_from_slice(&[0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]);
    
    // Create multipart form data with binary content
    let boundary = "test_boundary";
    let mut body = Vec::new();
    
    // Add the multipart form header
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"file\"; filename=\"corrupted.db\"\r\n");
    body.extend_from_slice(b"Content-Type: application/x-sqlite3\r\n\r\n");
    
    // Add the corrupted data
    body.extend_from_slice(&corrupted_data);
    
    // Add the multipart form footer
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/databases/upload")
                .header("content-type", format!("multipart/form-data; boundary={}", boundary))
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    
    let body = read_response_body(response).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert!(json["error"].as_str().unwrap().contains("Failed to read database structure"));
    
    test_env.cleanup();
} 