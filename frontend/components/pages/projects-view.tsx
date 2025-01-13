"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderGit2 } from 'lucide-react'

export function ProjectsView() {
  const projects = [
    { name: "User Authentication", description: "Auth service integration", commits: 156 },
    { name: "API Gateway", description: "Gateway service", commits: 89 },
    { name: "Data Pipeline", description: "ETL processes", commits: 234 },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card key={project.name}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FolderGit2 className="mr-2 h-4 w-4" />
              {project.name}
            </CardTitle>
            <CardDescription>{project.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {project.commits} commits
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

