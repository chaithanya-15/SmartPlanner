import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { findOverlappingTasks, summarizeConflicts } from "@/lib/scheduling"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.task.findUnique({ where: { id }, include: { sessions: true } })
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Only reschedule (and only conflict-check) when the caller actually sent
    // new times - a partial update like { status: "DONE" } must never wipe
    // out or re-validate a task's existing schedule.
    type SessionInput = { startTime: string; endTime: string }
    const hasSessions = "sessions" in body
    const isRescheduling = !hasSessions && ("startTime" in body || "endTime" in body)
    let startTime: Date | null | undefined
    let endTime: Date | null | undefined

    if (hasSessions) {
      // Multi-block edit: every block is authoritative and replaces the
      // task's existing sessions. Check each block individually, same as
      // the create flow, since one block can conflict while others don't.
      const sessions: SessionInput[] = body.sessions || []

      const invertedBlock = sessions.find((s) => new Date(s.endTime).getTime() <= new Date(s.startTime).getTime())
      if (invertedBlock) {
        return NextResponse.json(
          { error: "A time block's end time must be after its start time." },
          { status: 400 }
        )
      }

      if (sessions.length > 0) {
        startTime = new Date(Math.min(...sessions.map((s) => new Date(s.startTime).getTime())))
        endTime = new Date(Math.max(...sessions.map((s) => new Date(s.endTime).getTime())))
      } else {
        startTime = null
        endTime = null
      }

      if (!body.confirmOverlap) {
        const conflictsById = new Map<string, Awaited<ReturnType<typeof findOverlappingTasks>>[number]>()
        for (const s of sessions) {
          const conflicts = await findOverlappingTasks(new Date(s.startTime), new Date(s.endTime), id)
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
    } else if (isRescheduling) {
      // A caller may only send one of startTime/endTime (e.g. dragging just
      // the edge of an event). Merge with the existing value for whichever
      // key wasn't sent instead of nulling it out - that was the landmine:
      // `body.endTime ? ... : null` used to wipe endTime whenever only
      // startTime was present in the request.
      startTime = "startTime" in body ? (body.startTime ? new Date(body.startTime) : null) : existing.startTime
      endTime = "endTime" in body ? (body.endTime ? new Date(body.endTime) : null) : existing.endTime

      if (startTime && endTime && endTime.getTime() <= startTime.getTime()) {
        return NextResponse.json(
          { error: "End time must be after start time." },
          { status: 400 }
        )
      }

      if (startTime && endTime) {
        const conflicts = await findOverlappingTasks(startTime, endTime, id)
        if (conflicts.length > 0 && !body.confirmOverlap) {
          return NextResponse.json(
            {
              conflict: true,
              message: `That time slot overlaps with ${conflicts.length} existing task(s).`,
              conflictingTasks: summarizeConflicts(conflicts),
            },
            { status: 409 }
          )
        }
      }
    }

    // Deriving real actual time / completedAt on a DONE transition, same rule
    // as the chat assistant's updateTask tool, so every completion path
    // (dashboard checkbox, edit modal, chat) records the same kind of data.
    let actualMinutes: number | undefined
    let completedAt: Date | null | undefined
    if ("status" in body) {
      if (body.status === "DONE" && existing.status !== "DONE") {
        completedAt = new Date()
        if (!("actualMinutes" in body)) {
          actualMinutes =
            existing.sessions.length > 0
              ? Math.round(
                  existing.sessions.reduce(
                    (acc, s) => acc + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000,
                    0
                  )
                )
              : existing.estimatedMinutes ?? undefined
        }
      } else if (body.status !== "DONE" && existing.status === "DONE") {
        completedAt = null
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...("title" in body && { title: body.title }),
        ...("description" in body && { description: body.description }),
        ...("status" in body && { status: body.status }),
        ...("priority" in body && { priority: body.priority }),
        ...((isRescheduling || hasSessions) && { startTime, endTime }),
        ...(hasSessions && {
          sessions: {
            deleteMany: {},
            create: (body.sessions || []).map((s: SessionInput) => ({
              startTime: new Date(s.startTime),
              endTime: new Date(s.endTime),
            })),
          },
        }),
        ...("recurrenceRule" in body && { recurrenceRule: body.recurrenceRule }),
        ...("estimatedMinutes" in body && {
          estimatedMinutes: body.estimatedMinutes ? parseInt(body.estimatedMinutes) : null,
        }),
        ...("actualMinutes" in body && { actualMinutes: body.actualMinutes ? parseInt(body.actualMinutes) : null }),
        ...(actualMinutes !== undefined && { actualMinutes }),
        ...(completedAt !== undefined && { completedAt }),
      },
      include: {
        sessions: true
      }
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error("PUT task error:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.task.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE task error:", error)
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
