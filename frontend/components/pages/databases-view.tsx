"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { apiClient, DatabaseMetadata } from "@/lib/api-client"
import { Database, Star, Upload } from "lucide-react"

export function DatabasesView() {
  const [databases, setDatabases] = useState<DatabaseMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDatabases()
  }, [])

  const loadDatabases = async () => {
    try {
      setLoading(true)
      const data = await apiClient.listDatabases()
      setDatabases(data)
      setError(null)
    } catch (err) {
      setError('Failed to load databases')
      console.error('Failed to load databases:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTest = async () => {
    try {
      const database = await apiClient.createTestDatabase()
      setDatabases(prev => [database, ...prev])
      setError(null)
    } catch (err) {
      setError('Failed to create test database')
      console.error('Failed to create test database:', err)
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const database = await apiClient.uploadDatabase(file)
      setDatabases(prev => [database, ...prev])
      setError(null)
    } catch (err) {
      setError('Failed to upload database')
      console.error('Failed to upload database:', err)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Databases</h2>
          <p className="text-muted-foreground">Manage and explore your SQLite databases</p>
        </div>
        <div className="space-x-2">
          <Button onClick={handleCreateTest}>
            <Database className="mr-2 h-4 w-4" />
            Create Test DB
          </Button>
          <Button onClick={() => document.getElementById('db-upload')?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Database
          </Button>
          <input
            id="db-upload"
            type="file"
            accept=".db,.sqlite,.sqlite3"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {databases.map((db) => (
          <Card key={db.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {db.name}
              </CardTitle>
              {db.is_favorite && <Star className="h-4 w-4 text-yellow-400" />}
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                <p>Path: {db.path}</p>
                <p>Size: {(db.size / 1024).toFixed(2)} KB</p>
                <p>Tables: {db.table_count}</p>
                <p>Last accessed: {new Date(db.last_accessed).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

