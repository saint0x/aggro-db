use serde::{Serialize, Deserialize};
use rusqlite::{Connection, params, types::{FromSql, ToSql, ValueRef}};
use anyhow::Result;
use chrono::{DateTime, Utc};
use crate::db::connection::DbConnection;
use rusqlite::OptionalExtension;

// Wrapper type for DateTime<Utc> to implement rusqlite traits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbDateTime(DateTime<Utc>);

impl From<DateTime<Utc>> for DbDateTime {
    fn from(dt: DateTime<Utc>) -> Self {
        DbDateTime(dt)
    }
}

impl From<DbDateTime> for DateTime<Utc> {
    fn from(dt: DbDateTime) -> Self {
        dt.0
    }
}

impl FromSql for DbDateTime {
    fn column_result(value: ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
        value.as_str().and_then(|s| {
            DateTime::parse_from_rfc3339(s)
                .map(|dt| DbDateTime(dt.with_timezone(&Utc)))
                .map_err(|e| rusqlite::types::FromSqlError::Other(Box::new(e)))
        })
    }
}

impl ToSql for DbDateTime {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        Ok(rusqlite::types::ToSqlOutput::from(self.0.to_rfc3339()))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DatabaseMetadata {
    pub id: Option<i64>,
    pub name: String,
    pub path: String,
    pub size: i64,
    pub table_count: i32,
    pub is_favorite: bool,
    pub notes: Option<String>,
    #[serde(with = "datetime_serialization")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "datetime_serialization")]
    pub updated_at: Option<DateTime<Utc>>,
}

// Helper module for DateTime serialization
mod datetime_serialization {
    use super::*;
    use serde::{Serializer, Deserializer};

    pub fn serialize<S>(date: &Option<DateTime<Utc>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match date {
            Some(dt) => serializer.serialize_str(&dt.to_rfc3339()),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt_str: Option<String> = Option::deserialize(deserializer)?;
        match opt_str {
            Some(s) => DateTime::parse_from_rfc3339(&s)
                .map(|dt| Some(dt.with_timezone(&Utc)))
                .map_err(serde::de::Error::custom),
            None => Ok(None),
        }
    }
}

impl DatabaseMetadata {
    pub fn new(
        name: String,
        path: String,
        size: i64,
        table_count: i32,
        is_favorite: bool,
        notes: Option<String>,
    ) -> Self {
        Self {
            id: None,
            name,
            path,
            size,
            table_count,
            is_favorite,
            notes,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        }
    }

    pub fn list(db_connection: &DbConnection) -> Result<Vec<DatabaseMetadata>> {
        let conn = Self::init_metadata_db(db_connection)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, size, table_count, is_favorite, notes, created_at, updated_at 
             FROM database_metadata 
             ORDER BY created_at DESC"
        )?;

        let metadata_iter = stmt.query_map([], |row| {
            let created_at: DbDateTime = row.get(7)?;
            let updated_at: DbDateTime = row.get(8)?;
            
            Ok(DatabaseMetadata {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                path: row.get(2)?,
                size: row.get(3)?,
                table_count: row.get(4)?,
                is_favorite: row.get(5)?,
                notes: row.get(6)?,
                created_at: Some(created_at.into()),
                updated_at: Some(updated_at.into()),
            })
        })?;

        let mut metadata = Vec::new();
        for item in metadata_iter {
            metadata.push(item?);
        }

        Ok(metadata)
    }

    pub fn save(&self, db_connection: &DbConnection) -> Result<DatabaseMetadata> {
        let conn = Self::init_metadata_db(db_connection)?;
        
        if let Some(id) = self.id {
            // Update existing record
            conn.execute(
                "UPDATE database_metadata 
                 SET name = ?, path = ?, size = ?, table_count = ?, is_favorite = ?, notes = ?, updated_at = ?
                 WHERE id = ?",
                params![
                    self.name,
                    self.path,
                    self.size,
                    self.table_count,
                    self.is_favorite,
                    self.notes,
                    DbDateTime::from(self.updated_at.unwrap_or_else(Utc::now)),
                    id,
                ],
            )?;
            Ok(self.clone())
        } else {
            // Insert new record
            conn.execute(
                "INSERT INTO database_metadata 
                 (name, path, size, table_count, is_favorite, notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    self.name,
                    self.path,
                    self.size,
                    self.table_count,
                    self.is_favorite,
                    self.notes,
                    DbDateTime::from(self.created_at.unwrap_or_else(Utc::now)),
                    DbDateTime::from(self.updated_at.unwrap_or_else(Utc::now)),
                ],
            )?;
            
            let id = conn.last_insert_rowid();
            let mut new_metadata = self.clone();
            new_metadata.id = Some(id);
            Ok(new_metadata)
        }
    }

    pub fn find_by_id(db_connection: &DbConnection, id: i64) -> Result<Option<DatabaseMetadata>> {
        let conn = Self::init_metadata_db(db_connection)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, size, table_count, is_favorite, notes, created_at, updated_at 
             FROM database_metadata 
             WHERE id = ?"
        )?;

        let metadata = stmt.query_row(params![id], |row| {
            let created_at: DbDateTime = row.get(7)?;
            let updated_at: DbDateTime = row.get(8)?;
            
            Ok(DatabaseMetadata {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                path: row.get(2)?,
                size: row.get(3)?,
                table_count: row.get(4)?,
                is_favorite: row.get(5)?,
                notes: row.get(6)?,
                created_at: Some(created_at.into()),
                updated_at: Some(updated_at.into()),
            })
        }).optional()?;

        Ok(metadata)
    }

    pub fn delete(db_connection: &DbConnection, id: i64) -> Result<()> {
        let conn = Self::init_metadata_db(db_connection)?;
        
        conn.execute(
            "DELETE FROM database_metadata WHERE id = ?",
            params![id],
        )?;

        Ok(())
    }

    fn init_metadata_db(db_connection: &DbConnection) -> Result<Connection> {
        let metadata_db_path = db_connection.get_storage_path("metadata.db");
        let conn = Connection::open(&metadata_db_path)?;

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
        )?;

        Ok(conn)
    }
} 