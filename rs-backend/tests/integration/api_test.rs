use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
    response::Response,
};
use tower::ServiceExt;
use serde_json::{Value, json};
use bytes::Bytes;

use crate::common::TestEnv;
use rs_backend::db::connection::DbConnection;

pub async fn setup_test_app() -> (Router, DbConnection, TestEnv) {
    let test_env = TestEnv::new();
    let db_connection = DbConnection::new();
    let app = rs_backend::create_app(db_connection.clone());
    
    // Create metadata database
    test_env.create_metadata_db();
    
    (app, db_connection, test_env)
}

async fn read_response_body(response: Response) -> Result<Bytes, String> {
    axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .map_err(|e| e.to_string())
}

#[tokio::test]
async fn test_health_check() {
    let (app, _, test_env) = setup_test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_response_body(response).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "ok");
    assert!(json["timestamp"].is_string());
    
    test_env.cleanup();
}

#[tokio::test]
async fn test_list_databases_empty() {
    let (app, _, test_env) = setup_test_app().await;
    
    let response = app
        .oneshot(Request::builder().uri("/databases").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_response_body(response).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    let databases = json["databases"].as_array().expect("Response should have databases array");
    assert!(databases.is_empty());
    
    test_env.cleanup();
}

#[tokio::test]
async fn test_database_not_found() {
    let (app, _, test_env) = setup_test_app().await;
    
    let response = app
        .oneshot(
            Request::builder()
                .uri("/databases/999999")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    
    let body = read_response_body(response).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["error"].as_str().unwrap(), "Database not found");
    
    test_env.cleanup();
}

#[tokio::test]
async fn test_delete_nonexistent_database() {
    let (app, _, test_env) = setup_test_app().await;
    
    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/databases/999999")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    
    let body = read_response_body(response).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"], "Database not found");
    
    test_env.cleanup();
}

#[tokio::test]
async fn test_update_nonexistent_database() {
    let (app, _, test_env) = setup_test_app().await;
    
    let update = json!({
        "name": "Updated Name"
    });
    
    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/databases/999999")
                .header("content-type", "application/json")
                .body(Body::from(update.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    
    let body = read_response_body(response).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"], "Database not found");
    
    test_env.cleanup();
} 