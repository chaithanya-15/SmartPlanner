import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Must match POLL_INTERVAL_SECONDS in scripts/track-usage.mjs - each
// foreground sample stands in for this many seconds of real focus time.
const POLL_INTERVAL_SECONDS = 15

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const day = dateParam ? new Date(dateParam) : new Date()
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)

    const samples = await prisma.usageSample.findMany({
      where: { timestamp: { gte: dayStart, lte: dayEnd } },
      orderBy: { timestamp: "asc" },
    })

    const foreground = samples.filter((s) => s.kind === "foreground")
    const background = samples.filter((s) => s.kind === "background")

    const hourlyMinutes = Array.from({ length: 24 }, () => 0)
    const appMinutes = new Map<string, number>()
    for (const s of foreground) {
      const hour = new Date(s.timestamp).getHours()
      hourlyMinutes[hour] += POLL_INTERVAL_SECONDS / 60
      appMinutes.set(s.appName, (appMinutes.get(s.appName) || 0) + POLL_INTERVAL_SECONDS / 60)
    }

    const topApps = Array.from(appMinutes.entries())
      .map(([app, minutes]) => ({ app, minutes: Math.round(minutes) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8)

    const backgroundAppNames = Array.from(new Set(background.map((s) => s.appName)))
    const backgroundApps = backgroundAppNames.map((app) => {
      const samplesForApp = background.filter((s) => s.appName === app)
      return { app, lastSeen: samplesForApp[samplesForApp.length - 1]?.timestamp }
    })

    const totalMinutes = Math.round(hourlyMinutes.reduce((a, b) => a + b, 0))

    return NextResponse.json({
      date: dayStart.toDateString(),
      totalMinutes,
      hourlyMinutes: hourlyMinutes.map((m) => Math.round(m)),
      topApps,
      backgroundApps,
      hasData: samples.length > 0,
    })
  } catch (error) {
    console.error("GET usage error:", error)
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
  }
}
