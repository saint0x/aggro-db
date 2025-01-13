import { Hono } from 'hono'
import { dbManager } from '../utils/db-manager'
import { QueriesModel, DatabasesModel } from '../db/models'
import { join } from 'path'

const queryRouter = new Hono()

// Execute SQL query
queryRouter.post('/', async (c) => {
  try {
    if (!dbManager.isConnected()) {
      return c.json({ error: 'No database loaded' }, 400)
    }

    const { sql } = await c.req.json()
    
    if (!sql) {
      return c.json({ error: 'No SQL query provided' }, 400)
    }

    const startTime = Date.now()
    let success = false
    let errorMessage: string | undefined
    let results: any

    try {
      const dbInfo = dbManager.getCurrentDatabaseInfo()
      results = await dbManager.executeQuery(sql)
      success = true

      // Add to history with results for offline access
      await QueriesModel.addToHistory({
        query: sql,
        database_name: dbInfo.name,
        database_path: dbInfo.path,
        execution_time_ms: Date.now() - startTime,
        success: true,
        results: results // This will be saved to a file
      })

      // For SELECT queries
      if (sql.trim().toLowerCase().startsWith('select')) {
        return c.json({ results })
      }
      
      // For other queries (INSERT, UPDATE, DELETE)
      return c.json({ 
        changes: results.changes,
        lastInsertId: results.lastInsertRowid
      })
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Add failed query to history
      const dbInfo = dbManager.getCurrentDatabaseInfo()
      await QueriesModel.addToHistory({
        query: sql,
        database_name: dbInfo.name,
        database_path: dbInfo.path,
        execution_time_ms: Date.now() - startTime,
        success: false,
        error_message: errorMessage
      })

      throw error
    }
  } catch (error) {
    console.error('Query error:', error)
    return c.json({ 
      error: 'Failed to execute query',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// Get saved queries
queryRouter.get('/saved', async (c) => {
  try {
    const queries = QueriesModel.getAllSavedQueries()
    return c.json({ queries })
  } catch (error) {
    console.error('Error fetching saved queries:', error)
    return c.json({ error: 'Failed to fetch saved queries' }, 500)
  }
})

// Save a query
queryRouter.post('/save', async (c) => {
  try {
    const body = await c.req.json()
    const { name, description, query, database_path, tags } = body

    if (!name || !query) {
      return c.json({ error: 'Name and query are required' }, 400)
    }

    const savedQuery = QueriesModel.saveQuery({
      name,
      description,
      query,
      database_path,
      tags,
      favorite: false
    })

    return c.json({ query: savedQuery })
  } catch (error) {
    console.error('Error saving query:', error)
    return c.json({ error: 'Failed to save query' }, 500)
  }
})

// Toggle query favorite status
queryRouter.post('/favorite/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const isFavorite = QueriesModel.toggleQueryFavorite(id)
    return c.json({ isFavorite })
  } catch (error) {
    console.error('Error toggling favorite status:', error)
    return c.json({ error: 'Failed to update favorite status' }, 500)
  }
})

// Search saved queries
queryRouter.get('/search', async (c) => {
  try {
    const term = c.req.query('term')
    if (!term) {
      return c.json({ error: 'Search term is required' }, 400)
    }

    const queries = QueriesModel.searchQueries(term)
    return c.json({ queries })
  } catch (error) {
    console.error('Error searching queries:', error)
    return c.json({ error: 'Failed to search queries' }, 500)
  }
})

// Get query analytics
queryRouter.get('/analytics', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30')
    const limit = parseInt(c.req.query('limit') || '10')

    const popular = QueriesModel.getPopularQueries(days, limit)
    const slow = QueriesModel.getSlowQueries(limit)

    return c.json({ 
      popular,
      slow,
      timeRange: {
        days,
        limit
      }
    })
  } catch (error) {
    console.error('Error fetching query analytics:', error)
    return c.json({ error: 'Failed to fetch query analytics' }, 500)
  }
})

export { queryRouter } 