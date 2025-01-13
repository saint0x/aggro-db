"use client"

import { useState, useEffect } from "react"
import { ResultsViewer } from "@/components/results-viewer"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { apiClient } from "@/lib/api-client"

interface StructureViewProps {
  databaseId: number;
}

export function StructureView({ databaseId }: StructureViewProps) {
  const [tables, setTables] = useState<Array<{
    "Table Name": string,
    "Columns": number,
    "Records": number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTableName, setNewTableName] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    loadTables()
  }, [databaseId]) // Reload when database ID changes

  const loadTables = async () => {
    try {
      console.log('Loading tables for database ID:', databaseId)
      setLoading(true)
      setError(null)
      const tables = await apiClient.getTables(databaseId)
      console.log('Received tables:', tables)
      
      // For each table, get its schema to count columns
      const tableDetails = await Promise.all(tables.map(async (table) => {
        const schema = await apiClient.getTableSchema(databaseId, table)
        return {
          "Table Name": table,
          "Columns": schema.length,
          "Records": 0 // TODO: Implement record counting
        }
      }))

      console.log('Processed table details:', tableDetails)
      setTables(tableDetails)
    } catch (err) {
      console.error('Failed to load tables:', err)
      setError('Failed to load database structure')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTable = async () => {
    if (!newTableName) return

    try {
      await apiClient.executeQuery(databaseId, `
        CREATE TABLE ${newTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT
        )
      `)
      
      setNewTableName("")
      setIsDialogOpen(false)
      loadTables()
    } catch (err) {
      console.error('Failed to create table:', err)
      setError('Failed to create table')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Database Structure</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Table
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Table</DialogTitle>
              <DialogDescription>
                Enter the name for your new table
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tableName">Table Name</Label>
                <Input
                  id="tableName"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="Enter table name..."
                />
              </div>
              <Button onClick={handleCreateTable} className="w-full">
                Create Table
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ResultsViewer
        columns={["Table Name", "Columns", "Records"]}
        data={tables}
      />
    </div>
  )
}

