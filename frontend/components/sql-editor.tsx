"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Play, Download, Copy, Trash2 } from 'lucide-react'

interface SQLEditorProps {
  onExecute: (sql: string) => void
}

export function SQLEditor({ onExecute }: SQLEditorProps) {
  const [sql, setSql] = useState("")

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onExecute(sql)}
          >
            <Play className="h-4 w-4 mr-2" />
            Run
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSql("")}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigator.clipboard.writeText(sql)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const blob = new Blob([sql], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'query.sql'
              a.click()
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-grow">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          className="w-full h-full min-h-[200px] p-4 font-mono text-sm bg-background resize-none focus:outline-none"
          placeholder="Enter your SQL query here..."
        />
      </ScrollArea>
    </Card>
  )
}

