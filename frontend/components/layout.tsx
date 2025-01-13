"use client"

import * as React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Database, Settings, HelpCircle, Upload, FolderGit2, Users, Clock, Home, Plus } from 'lucide-react'
import { HomeView } from "./pages/home-view"
import { DatabasesView } from "./pages/databases-view"
import { ProjectsView } from "./pages/projects-view"
import { TeamsView } from "./pages/teams-view"
import { CronView } from "./pages/cron-view"
import { SettingsView } from "./pages/settings-view"
import { HelpView } from "./pages/help-view"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { motion, HTMLMotionProps } from "framer-motion"

interface ShinyButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
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

export function DBLayout() {
  const [activePage, setActivePage] = useState<"home" | "databases" | "projects" | "teams" | "cron" | "settings" | "help">("home")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const renderContent = () => {
    switch (activePage) {
      case "home":
        return <HomeView />
      case "databases":
        return <DatabasesView />
      case "projects":
        return <ProjectsView />
      case "teams":
        return <TeamsView />
      case "cron":
        return <CronView />
      case "settings":
        return <SettingsView />
      case "help":
        return <HelpView />
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card p-4 flex flex-col">
        <div className="flex items-center mb-8">
          <Database className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-2xl font-bold">aggro.db</h1>
        </div>
        <nav className="space-y-2 flex-1">
          <ShinyButton
            icon={<Home className="h-4 w-4" />}
            onClick={() => setActivePage("home")}
            className={cn(activePage === "home" && "bg-accent text-accent-foreground")}
          >
            Home
          </ShinyButton>
          <ShinyButton
            icon={<Database className="h-4 w-4" />}
            onClick={() => setActivePage("databases")}
            className={cn(activePage === "databases" && "bg-accent text-accent-foreground")}
          >
            Databases
          </ShinyButton>
          <ShinyButton
            icon={<FolderGit2 className="h-4 w-4" />}
            onClick={() => setActivePage("projects")}
            className={cn(activePage === "projects" && "bg-accent text-accent-foreground")}
          >
            Projects
          </ShinyButton>
          <ShinyButton
            icon={<Users className="h-4 w-4" />}
            onClick={() => setActivePage("teams")}
            className={cn(activePage === "teams" && "bg-accent text-accent-foreground")}
          >
            Teams
          </ShinyButton>
          <ShinyButton
            icon={<Clock className="h-4 w-4" />}
            onClick={() => setActivePage("cron")}
            className={cn(activePage === "cron" && "bg-accent text-accent-foreground")}
          >
            Cron Jobs
          </ShinyButton>
        </nav>
        <Separator className="my-4" />
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <ShinyButton 
              icon={<Settings className="h-4 w-4" />}
              onClick={() => {
                setActivePage("settings")
                setIsSettingsOpen(true)
              }}
              className={cn(activePage === "settings" && "bg-accent text-accent-foreground")}
            >
              Settings
            </ShinyButton>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Configure your database connection and preferences
              </DialogDescription>
            </DialogHeader>
            <SettingsView />
          </DialogContent>
        </Dialog>
        <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
          <DialogTrigger asChild>
            <ShinyButton 
              icon={<HelpCircle className="h-4 w-4" />}
              onClick={() => {
                setActivePage("help")
                setIsHelpOpen(true)
              }}
              className={cn(activePage === "help" && "bg-accent text-accent-foreground")}
            >
              Help
            </ShinyButton>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Help & Documentation</DialogTitle>
              <DialogDescription>
                Learn how to use DB Nexus effectively
              </DialogDescription>
            </DialogHeader>
            <HelpView />
          </DialogContent>
        </Dialog>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-card p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              {activePage === "home" ? "Welcome to DB Nexus" : activePage.charAt(0).toUpperCase() + activePage.slice(1)}
            </h2>
            {activePage !== "home" && (
              <Button onClick={() => {/* Add new item logic */}}>
                <Plus className="mr-2 h-4 w-4" />
                {activePage === "databases" && "Add Database"}
                {activePage === "projects" && "Create Project"}
                {activePage === "teams" && "Add Team"}
                {activePage === "cron" && "Add Cron Job"}
              </Button>
            )}
            {activePage === "home" && (
              <Button onClick={() => document.getElementById('db-file-input')?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Open Database
              </Button>
            )}
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

