import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { findOverlappingTasks, summarizeConflicts } from "@/lib/scheduling"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    
    // Support filtering by date range for calendar. This needs to be a real
    // overlap check (startTime < end AND endTime > start) - matching only
    // "starts in range" or "ends in range" separately drops any task that
    // spans clean over the whole queried range (e.g. an all-day block).
    if (start && end) {
      where.startTime = { lt: new Date(end) }
      where.endTime = { gt: new Date(start) }
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        sessions: true
      }
    })
    
    return NextResponse.json(tasks)
  } catch (error) {
    console.error("GET tasks error:", error)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Check if sessions are provided
    const sessions = body.sessions || []
    
    // Set fallback start/end time from first/last session if available and not explicitly provided
    let startTime = body.startTime ? new Date(body.startTime) : null
    let endTime = body.endTime ? new Date(body.endTime) : null
    
    type SessionInput = { startTime: string; endTime: string }

    const invertedBlock = sessions.find(
      (s: SessionInput) => new Date(s.endTime).getTime() <= new Date(s.startTime).getTime()
    )
    if (invertedBlock) {
      return NextResponse.json(
        { error: "A time block's end time must be after its start time." },
        { status: 400 }
      )
    }
    if (startTime && endTime && endTime.getTime() <= startTime.getTime()) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 })
    }

    if (sessions.length > 0) {
      if (!startTime) startTime = new Date(Math.min(...sessions.map((s: SessionInput) => new Date(s.startTime).getTime())))
      if (!endTime) endTime = new Date(Math.max(...sessions.map((s: SessionInput) => new Date(s.endTime).getTime())))
    }

    // Check every block being scheduled (each session, or the single
    // startTime/endTime range for a task with no blocks) against existing
    // tasks so the calendar page can't silently double-book a slot.
    const rangesToCheck: { start: Date; end: Date }[] =
      sessions.length > 0
        ? sessions.map((s: SessionInput) => ({ start: new Date(s.startTime), end: new Date(s.endTime) }))
        : startTime && endTime
          ? [{ start: startTime, end: endTime }]
          : []

    if (rangesToCheck.length > 0 && !body.confirmOverlap) {
      const conflictsById = new Map<string, Awaited<ReturnType<typeof findOverlappingTasks>>[number]>()
      for (const range of rangesToCheck) {
        const conflicts = await findOverlappingTasks(range.start, range.end)
        for (const c of conflicts) conflictsById.set(c.id, c)
      }
      if (conflictsById.size > 0) {
        return NextResponse.json(
          {
            conflict: true,
            message: `That time slot overlaps with ${conflictsById.size} existing task(s).`,
            conflictingTasks: summarizeConflicts(Array.from(conflictsById.values())),
          },
          { status: 409 }
        )
      }
    }

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description,
        status: body.status || "TODO",
        priority: body.priority || "MEDIUM",
        startTime,
        endTime,
        recurrenceRule: body.recurrenceRule,
        estimatedMinutes: body.estimatedMinutes ? parseInt(body.estimatedMinutes) : null,
        sessions: sessions.length > 0 ? {
          create: sessions.map((s: SessionInput) => ({
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime)
          }))
        } : undefined
      },
      include: {
        sessions: true
      }
    })
    return NextResponse.json(task)
  } catch (error) {
    console.error("POST task error:", error)
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
}
