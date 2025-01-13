"use client"

import { useState } from "react"
import { SQLEditor } from "@/components/sql-editor"
import { ResultsViewer } from "@/components/results-viewer"
import { apiClient } from "@/lib/api-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

interface SQLViewProps {
  databaseId: number;
}

export function SQLView({ databaseId }: SQLViewProps) {
  const [queryResults, setQueryResults] = useState<{
    columns: string[]
    data: any[]
  }>({
    columns: [],
    data: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExecuteQuery = async (sql: string) => {
    try {
      setLoading(true)
      setError(null)

      const result = await apiClient.executeQuery(databaseId, sql)

      if (result.error) {
        setError(result.error)
        setQueryResults({ columns: [], data: [] })
        return
      }

      if (result.results) {
        // Extract columns from the first result row
        const columns = result.results.length > 0 
          ? Object.keys(result.results[0])
          : []

        setQueryResults({
          columns,
          data: result.results
        })
      } else {
        // Handle non-SELECT queries
        setQueryResults({
          columns: ['Status', 'Changes'],
          data: [{
            Status: 'Success',
            Changes: result.changes || 0
          }]
        })
      }
    } catch (err) {
      console.error('Failed to execute query:', err)
      setError(err instanceof Error ? err.message : 'Failed to execute query')
      setQueryResults({ columns: [], data: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-rows-2 gap-4 h-full">
      <SQLEditor onExecute={handleExecuteQuery} />
      
      {loading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <ResultsViewer
          columns={queryResults.columns}
          data={queryResults.data}
        />
      )}
    </div>
  )
}

