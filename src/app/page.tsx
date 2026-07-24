"use client"

import { useTasks, TaskWithSessions } from "@/hooks/use-tasks"
import { useUsage } from "@/hooks/use-usage"
import { useUIStore } from "@/hooks/use-ui-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { FocusByHourChart } from "@/components/focus-by-hour-chart"
import { CheckCircle2, Clock, CalendarDays, TrendingUp, Plus, Pencil, AlertCircle } from "lucide-react"

export default function Dashboard() {
  const { tasks, isLoading, updateTask } = useTasks()
  const { data: usage } = useUsage()
  const { openCreateTaskModal, openEditTaskModal } = useUIStore()

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse flex flex-col space-y-6">
        <div className="h-10 w-64 bg-muted rounded-lg"></div>
        <div className="grid gap-6 md:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
        </div>
        <div className="h-64 bg-muted rounded-xl"></div>
      </div>
    )
  }

  // A task's effective time window: its own startTime/endTime, or the outer
  // bounds of its scheduled sessions when it has multiple time blocks.
  const getEffectiveWindow = (task: TaskWithSessions) => {
    const sessions = task.sessions || []
    if (sessions.length > 0) {
      const starts = sessions.map(s => new Date(s.startTime).getTime())
      const ends = sessions.map(s => new Date(s.endTime).getTime())
      return { start: new Date(Math.min(...starts)), end: new Date(Math.max(...ends)) }
    }
    if (task.startTime && task.endTime) {
      return { start: new Date(task.startTime), end: new Date(task.endTime) }
    }
    return null
  }

  const now = new Date()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

  const activeTasks = tasks.filter(t => t.status !== "DONE")

  // Overdue: not done, and its scheduled time already ended (any day, including today).
  const overdueTasks = activeTasks.filter(t => {
    const w = getEffectiveWindow(t)
    return w ? w.end.getTime() < now.getTime() : false
  })
  const overdueIds = new Set(overdueTasks.map(t => t.id))

  // Today's Tasks: not done, not already overdue, and either scheduled for
  // today or unscheduled (floating tasks still need doing today).
  const todayTasks = activeTasks.filter(t => {
    if (overdueIds.has(t.id)) return false
    const w = getEffectiveWindow(t)
    if (!w) return true
    return w.start >= todayStart && w.start <= todayEnd
  })

  const highPriority = tasks.filter(t => t.priority === "HIGH" && t.status !== "DONE")
  const completedTasks = tasks.filter(t => t.status === "DONE")

  const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0

  // Focus Hours is real system usage (from scripts/track-usage.mjs), not a
  // count of scheduled time blocks - it reflects what's actually on screen.
  const focusHours = ((usage?.totalMinutes ?? 0) / 60).toFixed(1)

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10">
      <div className="flex justify-between items-end animate-in fade-in slide-in-from-top-4 duration-500">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent pb-1">
            Good Morning
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Here&apos;s a summary of your day.</p>
        </div>
        <Button 
          onClick={() => openCreateTaskModal()} 
          className="bg-primary/90 hover:bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all rounded-full px-6 py-6"
        >
          <Plus className="mr-2 h-5 w-5" />
          <span className="font-semibold text-base">New Task</span>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Card className="bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border-indigo-500/30 backdrop-blur-xl shadow-lg hover:shadow-indigo-500/10 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-indigo-200">Tasks Completed</CardTitle>
            <div className="p-2 bg-indigo-500/20 rounded-full">
              <CheckCircle2 className="h-5 w-5 text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-indigo-100">{completedTasks.length}</div>
            <p className="text-sm text-indigo-300/80 mt-1">Across all projects</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border-emerald-500/30 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/10 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-emerald-200">Completion Rate</CardTitle>
            <div className="p-2 bg-emerald-500/20 rounded-full">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-100">{completionRate}%</div>
            <Progress value={completionRate} className="mt-3 h-2 bg-emerald-950" indicatorColor="bg-emerald-400" />
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/10 shadow-lg hover:shadow-xl hover:bg-card/80 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Focus Hours</CardTitle>
            <div className="p-2 bg-muted rounded-full">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{focusHours}h</div>
            <p className="text-sm text-muted-foreground mt-1">Real screen time today, from app tracking</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/10 shadow-lg hover:shadow-xl hover:bg-card/80 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Upcoming Meetings</CardTitle>
            <div className="p-2 bg-muted rounded-full">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">2</div>
            <p className="text-sm text-muted-foreground mt-1">Next one in 45m</p>
          </CardContent>
        </Card>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-6 duration-900">
        <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xl">Focus by Hour</CardTitle>
            <CardDescription className="text-sm">Real app usage today, by hour of day.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <FocusByHourChart />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <Card className="lg:col-span-2 bg-card/40 backdrop-blur-md border-white/10 shadow-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xl">Today&apos;s Tasks</CardTitle>
            <CardDescription className="text-sm">You have {todayTasks.length} tasks remaining today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 opacity-20" />
                <p>No tasks for today. Take a break!</p>
              </div>
            ) : (
              todayTasks.slice(0, 5).map(task => (
                <TaskRow key={task.id} task={task} onToggleDone={() => updateTask.mutate({ id: task.id, status: "DONE" })} onEdit={() => openEditTaskModal(task)} />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              High Priority <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
            </CardTitle>
            <CardDescription className="text-sm">Critical tasks that need attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {highPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No high priority tasks.</p>
            ) : (
              highPriority.map(task => (
                <div key={task.id} className="flex flex-col space-y-2 p-4 rounded-xl border-l-4 border-l-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer" onClick={() => openEditTaskModal(task)}>
                  <p className="text-base font-medium leading-tight">{task.title}</p>
                  <p className="text-xs text-destructive/80 font-medium">Due today</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              Overdue <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardTitle>
            <CardDescription className="text-sm">Not completed, and their scheduled time has already passed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nothing overdue. You&apos;re caught up.</p>
            ) : (
              overdueTasks.map(task => (
                <TaskRow key={task.id} task={task} overdue onToggleDone={() => updateTask.mutate({ id: task.id, status: "DONE" })} onEdit={() => openEditTaskModal(task)} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TaskRow({ task, overdue, onToggleDone, onEdit }: { task: TaskWithSessions, overdue?: boolean, onToggleDone: () => void, onEdit: () => void }) {
  return (
    <div className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${overdue ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10" : "border-border/50 bg-background/50 hover:bg-accent/80 hover:scale-[1.01] hover:shadow-md"}`}>
      <div className="flex items-center space-x-4">
        <div className="relative flex items-center justify-center">
          <input
            type="checkbox"
            className="peer h-5 w-5 rounded-full border-2 border-muted-foreground/50 text-primary focus:ring-primary focus:ring-offset-background transition-all cursor-pointer appearance-none checked:bg-primary checked:border-primary"
            checked={false}
            onChange={onToggleDone}
          />
          <CheckCircle2 className="absolute w-3.5 h-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
        </div>
        <div>
          <p className="text-base font-medium leading-none group-hover:text-primary transition-colors">{task.title}</p>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-2">
            <Clock className="w-3 h-3" /> {task.estimatedMinutes}m
            <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
            <span className="uppercase tracking-wider text-[10px] font-bold">{task.priority}</span>
          </p>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={onEdit}>
        <Pencil className="w-4 h-4" />
      </Button>
    </div>
  )
}
