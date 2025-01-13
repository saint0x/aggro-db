"use client"

import { useEffect, useState } from "react"
import { DatabaseStore, type StoredDatabase } from "@/lib/stores/database-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, Clock, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RecentDatabasesProps {
  onDatabaseSelect: (db: StoredDatabase) => void
}

export function RecentDatabases({ onDatabaseSelect }: RecentDatabasesProps) {
  const [databases, setDatabases] = useState<StoredDatabase[]>([])

  useEffect(() => {
    // Load databases on mount and update when localStorage changes
    const loadDatabases = () => {
      setDatabases(DatabaseStore.getStoredDatabases())
    }

    loadDatabases()

    // Listen for storage changes
    window.addEventListener('storage', loadDatabases)
    return () => window.removeEventListener('storage', loadDatabases)
  }, [])

  const handleRemove = (path: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the card click
    DatabaseStore.removeDatabase(path)
    setDatabases(DatabaseStore.getStoredDatabases())
  }

  if (databases.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Databases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {databases.map((db) => (
              <Card
                key={db.path}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onDatabaseSelect(db)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{db.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(db.lastAccessed), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {db.tables.length} tables
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleRemove(db.path, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
} 