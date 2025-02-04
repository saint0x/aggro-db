# Rust Backend for AggroDB

This is the Rust implementation of the AggroDB backend service, providing identical functionality to the Node.js version.

## Features

- SQLite database management
- Database metadata storage
- File upload handling
- Table and schema inspection
- SQL query execution
- CORS support
- Error handling and logging

## Prerequisites

- Rust (latest stable version)
- Cargo (comes with Rust)
- SQLite3

## Setup

1. Clone the repository
2. Navigate to the `rs-backend` directory
3. Copy `.env.example` to `.env` and adjust settings if needed
4. Create the storage directories:
   ```bash
   mkdir -p storage/databases
   ```

## Development

To run the development server:

```bash
cargo run
```

The server will start on `http://localhost:3001` by default.

## API Endpoints

- `GET /health` - Health check
- `GET /databases` - List all databases
- `POST /databases/test` - Create a test database
- `POST /databases/upload` - Upload a new database
- `GET /databases/:id/tables` - List tables in a database
- `GET /databases/:id/tables/:table/schema` - Get table schema
- `POST /databases/:id/query` - Execute SQL query

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production) 