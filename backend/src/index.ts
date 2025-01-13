import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from './utils/logger'
import { dbConnection } from './db/connection'
import { databaseMetadataModel } from './db/models/database-metadata'
import { statSync } from 'fs'
import { join } from 'path'
import { Database } from 'bun:sqlite'

const app = new Hono()
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001

// Enable CORS for development
const isDev = process.env.NODE_ENV !== 'production'
app.use('/*', cors({
  origin: isDev ? '*' : ['http://localhost:3000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 3600,
}))

// Log all requests in development
if (isDev) {
  app.use('*', async (c, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    logger.debug(`${c.req.method} ${c.req.url} - ${ms}ms`)
  })
}

// Health check route
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// List databases
app.get('/databases', async (c) => {
  try {
    const databases = databaseMetadataModel.list()
    return c.json({ databases })
  } catch (error) {
    logger.error('Failed to list databases:', error)
    return c.json({ error: 'Failed to list databases' }, 500)
  }
})

// Add test database
app.post('/databases/test', async (c) => {
  try {
    const testDb = databaseMetadataModel.create({
      name: 'Test Database',
      path: '/path/to/test.db',
      size: 1024,
      table_count: 5,
      is_favorite: false,
      notes: 'This is a test database'
    })
    return c.json({ database: testDb })
  } catch (error) {
    logger.error('Failed to create test database:', error)
    return c.json({ error: 'Failed to create test database' }, 500)
  }
})

// Upload database
app.post('/databases/upload', async (c) => {
  let db: Database | null = null;
  let storagePath: string | null = null;

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    logger.info(`Uploading database: ${file.name}`);

    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    storagePath = join(dbConnection.getStoragePath('databases'), filename);

    // Save the file
    const buffer = await file.arrayBuffer();
    await Bun.write(storagePath, buffer);

    // Get file stats
    const stats = statSync(storagePath);
    logger.info(`File saved to: ${storagePath} (${stats.size} bytes)`);

    // Open the database to count tables
    db = new Database(storagePath);
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableCount = tables.length;
    db.close();
    db = null;

    logger.info(`Found ${tableCount} tables in database`);

    // Create database metadata
    const database = databaseMetadataModel.create({
      name: file.name,
      path: storagePath,
      size: stats.size,
      table_count: tableCount,
      is_favorite: false,
      notes: `Uploaded on ${new Date().toLocaleString()}`
    });

    if (!database) {
      throw new Error('Failed to create database metadata');
    }

    logger.info(`Database metadata created with ID: ${database.id}`);
    return c.json({ database });
  } catch (error) {
    // Clean up on error
    if (db) {
      db.close();
    }
    if (storagePath) {
      try {
        Bun.write(storagePath, ''); // Clear file contents
        // Note: We don't delete the file as it might be needed for debugging
      } catch (cleanupError) {
        logger.error('Failed to clean up database file:', cleanupError);
      }
    }

    logger.error('Failed to upload database:', error);
    return c.json({ 
      error: 'Failed to upload database', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get tables for a database
app.get('/databases/:id/tables', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const metadata = databaseMetadataModel.findById(id)
    if (!metadata) {
      return c.json({ error: 'Database not found' }, 404)
    }

    const db = new Database(metadata.path)
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    db.close()

    return c.json({ tables: tables.map(t => t.name) })
  } catch (error) {
    logger.error('Failed to get tables:', error)
    return c.json({ error: 'Failed to get tables' }, 500)
  }
})

// Get table schema
app.get('/databases/:id/tables/:table/schema', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const table = c.req.param('table')
    const metadata = databaseMetadataModel.findById(id)
    if (!metadata) {
      return c.json({ error: 'Database not found' }, 404)
    }

    const db = new Database(metadata.path)
    const schema = db.query(`PRAGMA table_info(${table})`).all()
    db.close()

    return c.json({ schema })
  } catch (error) {
    logger.error('Failed to get schema:', error)
    return c.json({ error: 'Failed to get schema' }, 500)
  }
})

// Execute query
app.post('/databases/:id/query', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { sql } = await c.req.json()
    const metadata = databaseMetadataModel.findById(id)
    if (!metadata) {
      return c.json({ error: 'Database not found' }, 404)
    }

    const db = new Database(metadata.path)
    const results = db.query(sql).all()
    db.close()

    return c.json({ results })
  } catch (error) {
    logger.error('Failed to execute query:', error)
    return c.json({ error: 'Failed to execute query', details: error.message }, 500)
  }
})

// Start server
logger.info('Initializing application...')
logger.info('Initializing database connection...')

serve({
  fetch: app.fetch,
  port
}, () => {
  logger.startupComplete(port)
}) 