"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from 'lucide-react'

export function TeamsView() {
  const teams = [
    { name: "Backend Team", members: 5, lead: "John Doe" },
    { name: "Frontend Team", members: 4, lead: "Jane Smith" },
    { name: "DevOps Team", members: 3, lead: "Bob Wilson" },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <Card key={team.name}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-4 w-4" />
              {team.name}
            </CardTitle>
            <CardDescription>Led by {team.lead}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {team.members} team members
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

