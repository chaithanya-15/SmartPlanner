"use client"

import { useMemo, useState } from "react"
import { useTasks, TaskWithSessions } from "@/hooks/use-tasks"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, TrendingUp, CheckCircle2, Clock, ListChecks } from "lucide-react"

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay() // 0 = Sun ... 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day // shift back to Monday
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  e.setHours(23, 59, 59, 999)
  return e
}
function addWeeks(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n * 7)
  return r
}
function getEffectiveWindow(task: TaskWithSessions) {
  const sessions = task.sessions || []
  if (sessions.length > 0) {
    const starts = sessions.map(s => new Date(s.startTime).getTime())
    const ends = sessions.map(s => new Date(s.endTime).getTime())
    return { start: new Date(Math.min(...starts)), end: new Date(Math.max(...ends)) }
  }
  if (task.startTime && task.endTime) return { start: new Date(task.startTime), end: new Date(task.endTime) }
  return null
}
// Which date "represents" a task for weekly bucketing: when it was
// completed if done, else its scheduled start, else when it was created.
function representativeDate(task: TaskWithSessions): Date {
  if (task.status === "DONE" && task.completedAt) return new Date(task.completedAt)
  const w = getEffectiveWindow(task)
  if (w) return w.start
  return new Date(task.createdAt)
}
function tasksInWeek(tasks: TaskWithSessions[], weekStart: Date, weekEnd: Date) {
  return tasks.filter(t => {
    const d = representativeDate(t)
    return d >= weekStart && d <= weekEnd
  })
}
function timeTaken(task: TaskWithSessions): { minutes: number, isEstimate: boolean } {
  if (task.actualMinutes != null) return { minutes: task.actualMinutes, isEstimate: false }
  if (task.estimatedMinutes != null) return { minutes: task.estimatedMinutes, isEstimate: true }
  return { minutes: 0, isEstimate: true }
}
function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
function formatRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`
}

function BarChart({ values, labels, color = "hsl(var(--primary))" }: { values: number[], labels: string[], color?: string }) {
  const max = Math.max(1, ...values)
  const width = 560
  const height = 160
  const barGap = 12
  const barWidth = (width - barGap * (values.length - 1)) / values.length

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full h-auto">
      {values.map((v, i) => {
        const barHeight = (v / max) * height
        const x = i * (barWidth + barGap)
        const y = height - barHeight
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, v > 0 ? 3 : 0)} rx={4} fill={color} opacity={0.9} />
            <text x={x + barWidth / 2} y={height + 16} textAnchor="middle" fontSize="11" fill="currentColor" opacity={0.6}>
              {labels[i]}
            </text>
            {v > 0 && (
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="currentColor" opacity={0.8}>
                {v}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function ProductivityPage() {
  const { tasks, isLoading } = useTasks()
  const [weekOffset, setWeekOffset] = useState(0)

  const now = new Date()
  const anchor = addWeeks(now, weekOffset)
  const weekStart = startOfWeek(anchor)
  const weekEnd = endOfWeek(anchor)

  const weekTasks = useMemo(
    () => tasksInWeek(tasks, weekStart, weekEnd).sort((a, b) => representativeDate(b).getTime() - representativeDate(a).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, weekStart.getTime(), weekEnd.getTime()]
  )
  const completed = weekTasks.filter(t => t.status === "DONE")
  const pending = weekTasks.filter(t => t.status !== "DONE")
  const productivityPct = weekTasks.length ? Math.round((completed.length / weekTasks.length) * 100) : 0
  const totalMinutesLogged = completed.reduce((acc, t) => acc + timeTaken(t).minutes, 0)

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const completedPerDay = dayLabels.map((_, i) => {
    const dayStart = new Date(weekStart); dayStart.setDate(dayStart.getDate() + i)
    const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999)
    return completed.filter(t => {
      const d = representativeDate(t)
      return d >= dayStart && d <= dayEnd
    }).length
  })

  // Completion-rate trend across this week and the 5 preceding it.
  const trend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const offset = weekOffset - (5 - i)
      const a = addWeeks(now, offset)
      const ws = startOfWeek(a)
      const we = endOfWeek(a)
      const wt = tasksInWeek(tasks, ws, we)
      const c = wt.filter(t => t.status === "DONE").length
      return {
        label: ws.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pct: wt.length ? Math.round((c / wt.length) * 100) : 0,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, weekOffset])

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse flex flex-col space-y-6">
        <div className="h-10 w-64 bg-muted rounded-lg"></div>
        <div className="h-64 bg-muted rounded-xl"></div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent pb-1">
            Productivity
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Weekly breakdown of what got done.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-40 text-center">{formatRange(weekStart, weekEnd)}</span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border-indigo-500/30 backdrop-blur-xl shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-indigo-200">Completed</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-indigo-100">{completed.length}</div>
            <p className="text-sm text-indigo-300/80 mt-1">of {weekTasks.length} tasks this week</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border-emerald-500/30 backdrop-blur-xl shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-emerald-200">Productivity</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-100">{productivityPct}%</div>
            <p className="text-sm text-emerald-300/80 mt-1">completed vs total this week</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/10 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Time Logged</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{formatMinutes(totalMinutesLogged)}</div>
            <p className="text-sm text-muted-foreground mt-1">across completed tasks</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/10 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Pending</CardTitle>
            <ListChecks className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{pending.length}</div>
            <p className="text-sm text-muted-foreground mt-1">still open this week</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xl">Completed per day</CardTitle>
            <CardDescription>This week, Monday through Sunday.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <BarChart values={completedPerDay} labels={dayLabels} />
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xl">Completion rate trend</CardTitle>
            <CardDescription>This week compared to the previous 5.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <BarChart values={trend.map(t => t.pct)} labels={trend.map(t => t.label)} color="hsl(var(--chart-2, 160 84% 39%))" />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-2xl">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-xl">This week&apos;s tasks</CardTitle>
          <CardDescription>{weekTasks.length} task{weekTasks.length === 1 ? "" : "s"} touched this week.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {weekTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nothing tracked for this week yet.</p>
          ) : (
            <div className="space-y-2">
              {weekTasks.map(task => {
                const { minutes, isEstimate } = timeTaken(task)
                const done = task.status === "DONE"
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${done ? "bg-emerald-400" : "bg-amber-400"}`} />
                      <p className="text-sm font-medium truncate">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                      <span>{representativeDate(task).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span>{formatMinutes(minutes)}{isEstimate ? " (est.)" : ""}</span>
                      <span className={`uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${done ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {done ? "Done" : task.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
