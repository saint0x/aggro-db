"use client"

import * as React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, Server, Table, GitBranch, Settings, HelpCircle, Plus, Upload, FileText, LayoutGrid } from 'lucide-react'
import { SQLEditor } from "./components/sql-editor"
import { ResultsViewer } from "./components/results-viewer"
import { DBUpload } from "./components/db-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { List, Grid, Image } from 'lucide-react'


interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}

const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, icon, ...props }, ref) => {
    const [isHovered, setIsHovered] = useState(false)

    return (
      <motion.button
        ref={ref}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative w-full rounded-lg px-4 py-2 font-medium text-left transition-all duration-300 ease-in-out",
          "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700",
          "border border-gray-300 dark:border-gray-600",
          "hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-700 dark:hover:to-gray-600",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900",
          className
        )}
        {...props}
      >
        <span className="flex items-center">
          {icon && <span className="mr-2">{icon}</span>}
          <span className="relative block text-sm font-semibold text-gray-800 dark:text-gray-200">
            {children}
          </span>
        </span>
        {isHovered && (
          <motion.span
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{
              repeat: Infinity,
              repeatType: "loop",
              duration: 1,
              ease: "linear",
            }}
            className="absolute inset-0 z-10 block rounded-[inherit] bg-gradient-to-r from-transparent via-white to-transparent opacity-20 dark:via-gray-300"
            style={{
              maskImage: "linear-gradient(90deg, transparent, #fff 50%, transparent)",
              WebkitMask: "linear-gradient(90deg, transparent, #fff 50%, transparent)",
            }}
          />
        )}
      </motion.button>
    )
  }
)

ShinyButton.displayName = "ShinyButton"

type ViewType = "list" | "card" | "gallery"

interface DatabaseCardProps {
  title: string
  description: string
  viewType: ViewType
}

const DatabaseCard = ({ title, description, viewType }: DatabaseCardProps) => {
  if (viewType === "list") {
    return (
      <div className="flex items-center justify-between p-4 border-b last:border-b-0">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ShinyButton className="w-auto">Connect</ShinyButton>
      </div>
    )
  }

  return (
    <Card className={cn(viewType === "gallery" && "h-[300px] flex flex-col")}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>Connected</span>
        </div>
      </CardContent>
      <CardFooter>
        <ShinyButton className="w-full">Connect</ShinyButton>
      </CardFooter>
    </Card>
  )
}

const databases = [
  { id: 1, title: "Production DB", description: "Main production database" },
  { id: 2, title: "Staging DB", description: "Staging environment database" },
  { id: 3, title: "Development DB", description: "Development environment database" },
  { id: 4, title: "Analytics DB", description: "Database for analytics data" },
  { id: 5, title: "Archive DB", description: "Archived data storage" },
  { id: 6, title: "Test DB", description: "Database for automated tests" },
]

export default function Component() {
  const [activeTab, setActiveTab] = useState("structure")
  const [activeDatabase, setActiveDatabase] = useState<File | null>(null)
  const [queryResults, setQueryResults] = useState<{
    columns: string[]
    data: any[]
  }>({
    columns: [],
    data: []
  })

  const handleFileSelect = (file: File) => {
    setActiveDatabase(file)
    // Here you would typically load the database structure
  }

  const handleExecuteQuery = (sql: string) => {
    // This is where you would execute the SQL query
    // For now, we'll just set some sample data
    setQueryResults({
      columns: ["id", "name", "email"],
      data: [
        { id: 1, name: "John Doe", email: "john@example.com" },
        { id: 2, name: "Jane Smith", email: "jane@example.com" },
      ]
    })
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card p-4 flex flex-col">
        <div className="flex items-center mb-8">
          <Database className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-2xl font-bold">DB Nexus</h1>
        </div>
        <nav className="space-y-2 flex-1">
          <ShinyButton
            icon={<Table className="h-4 w-4" />}
            onClick={() => setActiveTab("structure")}
            className={cn(activeTab === "structure" && "bg-accent text-accent-foreground")}
          >
            Structure
          </ShinyButton>
          <ShinyButton
            icon={<LayoutGrid className="h-4 w-4" />}
            onClick={() => setActiveTab("browse")}
            className={cn(activeTab === "browse" && "bg-accent text-accent-foreground")}
          >
            Browse Data
          </ShinyButton>
          <ShinyButton
            icon={<FileText className="h-4 w-4" />}
            onClick={() => setActiveTab("sql")}
            className={cn(activeTab === "sql" && "bg-accent text-accent-foreground")}
          >
            SQL Editor
          </ShinyButton>
          {/* Removed old sidebar items */}
        </nav>
        <Separator className="my-4" />
        <ShinyButton icon={<Settings className="h-4 w-4" />}>Settings</ShinyButton>
        <ShinyButton icon={<HelpCircle className="h-4 w-4" />}>Help</ShinyButton>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-card p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              {activeDatabase ? activeDatabase.name : "No Database Selected"}
            </h2>
            <Button onClick={() => document.getElementById('db-file-input')?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Open Database
            </Button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-6 overflow-hidden">
          {!activeDatabase ? (
            <DBUpload onFileSelect={handleFileSelect} />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList>
                <TabsTrigger value="structure">Structure</TabsTrigger>
                <TabsTrigger value="browse">Browse Data</TabsTrigger>
                <TabsTrigger value="sql">SQL Editor</TabsTrigger>
              </TabsList>
              <div className="mt-4 h-[calc(100%-40px)]">
                <TabsContent value="structure" className="h-full">
                  <ResultsViewer
                    columns={["Table Name", "Columns", "Records"]}
                    data={[
                      { "Table Name": "users", "Columns": 5, "Records": 100 },
                      { "Table Name": "products", "Columns": 8, "Records": 250 },
                    ]}
                  />
                </TabsContent>
                <TabsContent value="browse" className="h-full">
                  <ResultsViewer
                    columns={["id", "name", "email"]}
                    data={[
                      { id: 1, name: "John Doe", email: "john@example.com" },
                      { id: 2, name: "Jane Smith", email: "jane@example.com" },
                    ]}
                  />
                </TabsContent>
                <TabsContent value="sql" className="h-full">
                  <div className="grid grid-rows-2 gap-4 h-full">
                    <SQLEditor onExecute={handleExecuteQuery} />
                    <ResultsViewer
                      columns={queryResults.columns}
                      data={queryResults.data}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  )
}

