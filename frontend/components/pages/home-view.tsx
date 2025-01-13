"use client"

import { useState } from "react"
import { DBUpload } from "../db-upload"
import { SQLView } from "./sql-view"
import { StructureView } from "./structure-view"
import { Button } from "@/components/ui/button"
import { DatabaseMetadata } from "@/lib/api-client"
import { Database, TableProperties, Code } from "lucide-react"
import { apiClient } from "@/lib/api-client"

type ViewType = "upload" | "structure" | "sql"

export function HomeView() {
  const [currentView, setCurrentView] = useState<ViewType>("upload")
  const [currentDb, setCurrentDb] = useState<DatabaseMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (file: File) => {
    try {
      console.log('Uploading file:', file.name)
      const database = await apiClient.uploadDatabase(file)
      console.log('Upload response:', database)
      if (database) {
        setCurrentDb(database)
        setCurrentView("structure")
        setError(null)
      } else {
        throw new Error('No database returned from upload')
      }
    } catch (err) {
      setError('Failed to upload database')
      console.error('Failed to upload database:', err)
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-destructive">{error}</div>
      </div>
    )
  }

  if (!currentDb) {
    return <DBUpload onFileSelect={handleFileSelect} />
  }

  return (
    <div className="space-y-4 h-full">
      {/* View Selector */}
      <div className="flex justify-center space-x-2 pb-4 border-b">
        <Button
          variant={currentView === "structure" ? "default" : "outline"}
          onClick={() => setCurrentView("structure")}
          size="sm"
        >
          <TableProperties className="h-4 w-4 mr-2" />
          Structure
        </Button>
        <Button
          variant={currentView === "sql" ? "default" : "outline"}
          onClick={() => setCurrentView("sql")}
          size="sm"
        >
          <Code className="h-4 w-4 mr-2" />
          SQL Editor
        </Button>
      </div>

      {/* Database Info */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-lg">
        <div className="flex items-center space-x-2">
          <Database className="h-4 w-4" />
          <span className="font-medium">{currentDb.name}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {(currentDb.size / 1024).toFixed(2)} KB • {currentDb.table_count} tables
        </div>
      </div>

      {/* View Content */}
      <div className="h-[calc(100%-8rem)]">
        {currentView === "structure" && (
          <>
            {console.log('Rendering StructureView with database ID:', currentDb.id)}
            <StructureView databaseId={currentDb.id} />
          </>
        )}
        {currentView === "sql" && <SQLView databaseId={currentDb.id} />}
      </div>
    </div>
  )
}

