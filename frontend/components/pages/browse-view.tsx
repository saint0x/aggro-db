"use client"

import { useState, useEffect } from "react"
import { ResultsViewer } from "@/components/results-viewer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { DatabaseStore, type StoredDatabase } from "@/lib/stores/database-store"
import { RecentDatabases } from "@/components/recent-databases"
import { DBUpload } from "@/components/db-upload"

export function BrowseView() {
  const [selectedTable, setSelectedTable] = useState<string>("")
  const [tables, setTables] = useState<string[]>([])
  const [data, setData] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [currentDb, setCurrentDb] = useState<StoredDatabase | null>(null)
  const { toast } = useToast()

  // Load most recent database on mount
  useEffect(() => {
    const mostRecent = DatabaseStore.getMostRecent()
    if (mostRecent) {
      handleDatabaseSelect(mostRecent)
    }
  }, [])

  const handleDatabaseSelect = async (db: StoredDatabase) => {
    setCurrentDb(db)
    setTables(db.tables)
    if (db.tables.length > 0) {
      setSelectedTable(db.tables[0])
    }
    DatabaseStore.updateLastAccessed(db.path)
  }

  const handleUploadSuccess = (tables: string[]) => {
    setTables(tables)
    if (tables.length > 0) {
      setSelectedTable(tables[0])
    }
  }

  // Fetch table data when selection changes
  useEffect(() => {
    const fetchTableData = async () => {
      if (!selectedTable) return

      setLoading(true)
      try {
        const result = await apiClient.executeQuery(`SELECT * FROM ${selectedTable} LIMIT 100`)
        if (result.results) {
          setData(result.results)
          if (result.results.length > 0) {
            setColumns(Object.keys(result.results[0]))
          }
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch table data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    fetchTableData()
  }, [selectedTable, toast])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DBUpload onUploadSuccess={handleUploadSuccess} />
        <RecentDatabases onDatabaseSelect={handleDatabaseSelect} />
      </div>

      {currentDb && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">{currentDb.name}</h2>
              <p className="text-sm text-muted-foreground">
                {currentDb.tables.length} tables available
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="space-y-2">
              <Label>Select Table</Label>
              <Select
                value={selectedTable}
                onValueChange={setSelectedTable}
                disabled={loading}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : (
            <ResultsViewer
              columns={columns}
              data={data}
            />
          )}
        </div>
      )}
    </div>
  )
}

