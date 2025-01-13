"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Play, Pause } from 'lucide-react'

export function CronView() {
  const [cronJobs, setCronJobs] = useState([
    { name: "Daily Backup", schedule: "0 0 * * *", status: "active" },
    { name: "Weekly Report", schedule: "0 0 * * 0", status: "active" },
    { name: "Data Sync", schedule: "*/15 * * * *", status: "paused" },
  ])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cronJobs.map((job) => (
        <Card key={job.name}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {job.name}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{job.schedule}</div>
            <p className="text-xs text-muted-foreground">Cron schedule</p>
            <div className="mt-4 flex items-center justify-between">
              <div className={`flex items-center ${
                job.status === "active" ? "text-green-500" : "text-yellow-500"
              }`}>
                <div className="h-2 w-2 rounded-full mr-2 bg-current" />
                {job.status}
              </div>
              <Button variant="ghost" size="icon">
                {job.status === "active" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

