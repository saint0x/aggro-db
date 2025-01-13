"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Card, CardContent } from "@/components/ui/card"
import { Database } from 'lucide-react'
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { DatabaseStore } from "@/lib/stores/database-store"

interface DBUploadProps {
  onFileSelect: (file: File) => void
}

export function DBUpload({ onFileSelect }: DBUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && file.name.endsWith('.db')) {
      setIsUploading(true)
      try {
        onFileSelect(file)
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to process database file",
          variant: "destructive",
        })
      } finally {
        setIsUploading(false)
      }
    } else {
      toast({
        title: "Error",
        description: "Please upload a valid SQLite database file (.db)",
        variant: "destructive",
      })
    }
  }, [onFileSelect, toast])

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/x-sqlite3': ['.db'],
    },
    multiple: false,
    disabled: isUploading,
  })

  return (
    <Card
      {...getRootProps()}
      className={`
        cursor-pointer
        transition-colors
        w-full
        border border-dashed
        ${isDragging ? 'bg-primary/10' : 'bg-background'}
        ${isUploading ? 'opacity-50' : ''}
      `}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
    >
      <CardContent className="flex flex-col items-center justify-center py-12">
        <input {...getInputProps()} id="db-file-input" />
        <Database className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          {isUploading 
            ? "Uploading..."
            : "Drag and drop a SQLite database file (.db) here, or click to select"
          }
        </p>
      </CardContent>
    </Card>
  )
}

