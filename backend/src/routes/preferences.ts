import { Hono } from 'hono'
import { PreferencesModel } from '../db/models'

const preferencesRouter = new Hono()

// Get all preferences
preferencesRouter.get('/', async (c) => {
  try {
    const preferences = await PreferencesModel.getAllPreferences()
    return c.json({ preferences })
  } catch (error) {
    console.error('Error fetching preferences:', error)
    return c.json({ error: 'Failed to fetch preferences' }, 500)
  }
})

// Set a preference
preferencesRouter.post('/', async (c) => {
  try {
    const { key, value } = await c.req.json()
    
    if (!key || value === undefined) {
      return c.json({ error: 'Key and value are required' }, 400)
    }

    await PreferencesModel.setPreference(key, String(value))
    return c.json({ success: true })
  } catch (error) {
    console.error('Error setting preference:', error)
    return c.json({ error: 'Failed to set preference' }, 500)
  }
})

// Set multiple preferences
preferencesRouter.post('/bulk', async (c) => {
  try {
    const preferences = await c.req.json()
    
    if (!preferences || typeof preferences !== 'object') {
      return c.json({ error: 'Preferences object is required' }, 400)
    }

    await PreferencesModel.setMultiplePreferences(
      Object.fromEntries(
        Object.entries(preferences).map(([k, v]) => [k, String(v)])
      )
    )
    return c.json({ success: true })
  } catch (error) {
    console.error('Error setting preferences:', error)
    return c.json({ error: 'Failed to set preferences' }, 500)
  }
})

// Get theme preferences
preferencesRouter.get('/theme', async (c) => {
  try {
    const preferences = await PreferencesModel.getThemePreferences()
    return c.json({ preferences })
  } catch (error) {
    console.error('Error fetching theme preferences:', error)
    return c.json({ error: 'Failed to fetch theme preferences' }, 500)
  }
})

// Get editor preferences
preferencesRouter.get('/editor', async (c) => {
  try {
    const preferences = await PreferencesModel.getEditorPreferences()
    return c.json({ preferences })
  } catch (error) {
    console.error('Error fetching editor preferences:', error)
    return c.json({ error: 'Failed to fetch editor preferences' }, 500)
  }
})

// Initialize default preferences
preferencesRouter.post('/initialize', async (c) => {
  try {
    await PreferencesModel.initializeDefaultPreferences()
    return c.json({ success: true })
  } catch (error) {
    console.error('Error initializing preferences:', error)
    return c.json({ error: 'Failed to initialize preferences' }, 500)
  }
})

// Delete a preference
preferencesRouter.delete('/:key', async (c) => {
  try {
    const key = c.req.param('key')
    await PreferencesModel.deletePreference(key)
    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting preference:', error)
    return c.json({ error: 'Failed to delete preference' }, 500)
  }
})

export { preferencesRouter } 