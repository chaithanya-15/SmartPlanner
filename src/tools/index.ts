import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { findOverlappingTasks, summarizeConflicts } from "@/lib/scheduling"
import { resolveDateTime, addMinutes } from "@/lib/time-parse"

const CONFLICT_PARAM = z
  .boolean()
  .default(false)
  .describe(
    "Only set true if the user has already been told about a scheduling conflict and explicitly confirmed they want to proceed anyway."
  )

const TIME_FIELD_DESCRIPTION =
  "When this should happen. Pass an ISO 8601 datetime, or the time phrase the user actually said (e.g. '10pm today', '3:30pm tomorrow', 'in 30 minutes'). Do NOT do the date math yourself — pass the phrase through and it will be resolved against the real current time."

/**
 * Fuzzy-matches a task by title. Returns exactly one task, or a structured
 * "no match" / "ambiguous" result so callers never silently act on the
 * wrong task when more than one shares a word (e.g. "Call mom" vs "Call
 * dentist" both matching "call").
 */
async function findUniqueTaskByTitle(titleSearch: string, { excludeDone = false } = {}) {
  const matches = await prisma.task.findMany({
    where: {
      title: { contains: titleSearch },
      ...(excludeDone && { status: { not: "DONE" } }),
    },
    orderBy: { updatedAt: "desc" },
    include: { sessions: true },
  })

  if (matches.length === 0) {
    return { task: null, error: { success: false, message: `No task found matching "${titleSearch}".` } }
  }
  if (matches.length > 1) {
    return {
      task: null,
      error: {
        success: false,
        ambiguous: true,
        message: `Multiple tasks match "${titleSearch}": ${matches.map((t) => t.title).join(", ")}. Ask the user which one they mean before doing anything — do not guess.`,
      },
    }
  }
  return { task: matches[0], error: null }
}

/**
 * Tool: createTask
 * Creates a new task in the database from natural language input.
 */
export const createTask = tool({
  description:
    "Create a new task in the user's planner. Use this when the user wants to add, schedule, or create any task or reminder.",
  parameters: z.object({
    title: z
      .string()
      .default("New Task")
      .describe(
        "A short, clean task title only — never include the date, time, or duration in the title text. e.g. 'Phone call with parents', not 'Phone call with parents at 10pm today'."
      ),
    priority: z
      .enum(["LOW", "MEDIUM", "HIGH"])
      .default("MEDIUM")
      .describe("The priority level of the task"),
    startTime: z.string().optional().describe(TIME_FIELD_DESCRIPTION),
    durationMinutes: z
      .number()
      .optional()
      .describe("How long the task should last, in minutes, if the user gave a duration (e.g. '30 minutes' -> 30). Takes priority over estimatedMinutes for computing the end time."),
    estimatedMinutes: z
      .number()
      .optional()
      .describe("Estimated time to complete the task in minutes, if no explicit duration was given"),
    endTime: z
      .string()
      .optional()
      .describe(`${TIME_FIELD_DESCRIPTION} Only set this if the user gave an explicit end time rather than a duration.`),
    description: z.string().optional().describe("Optional description or notes for the task"),
    confirmOverlap: CONFLICT_PARAM,
  }),
  // @ts-expect-error type inference mismatch
  execute: async ({ title, priority, estimatedMinutes, durationMinutes, startTime, endTime, description, confirmOverlap }) => {
    let start: Date | null = null
    let end: Date | null = null

    if (startTime) {
      start = resolveDateTime(startTime)
      if (!start) {
        return {
          success: false,
          message: `I couldn't understand the start time "${startTime}". Ask the user to clarify (e.g. "10pm today").`,
        }
      }

      if (endTime) {
        end = resolveDateTime(endTime)
        if (!end) {
          return {
            success: false,
            message: `I couldn't understand the end time "${endTime}". Ask the user to clarify.`,
          }
        }
      } else {
        end = addMinutes(start, durationMinutes ?? estimatedMinutes ?? 60)
      }

      if (end.getTime() <= start.getTime()) {
        return { success: false, message: "The end time must be after the start time. Ask the user to clarify." }
      }

      const conflicts = await findOverlappingTasks(start, end)
      if (conflicts.length > 0 && !confirmOverlap) {
        return {
          success: false,
          conflict: true,
          message: `That time slot overlaps with ${conflicts.length} existing task(s). Ask the user to confirm before double-booking.`,
          conflictingTasks: summarizeConflicts(conflicts),
        }
      }
    }

    const finalEstimatedMinutes =
      start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : durationMinutes ?? estimatedMinutes ?? null

    const task = await prisma.task.create({
      data: {
        title,
        priority,
        estimatedMinutes: finalEstimatedMinutes,
        startTime: start,
        endTime: end,
        description,
        status: "TODO",
      },
    })
    return JSON.parse(JSON.stringify({ success: true, task }))
  },
})

/**
 * Tool: updateTask
 * Updates an existing task by fuzzy-matching its title.
 */
export const updateTask = tool({
  description:
    "Update an existing task. Use this to mark a task as done, change its priority, or modify its title. Fuzzy-match the title to find the right task.",
  parameters: z.object({
    titleSearch: z.string().describe("Part of the task title to search for"),
    status: z
      .enum(["TODO", "IN_PROGRESS", "DONE"])
      .optional()
      .describe("New status for the task"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().describe("New priority for the task"),
    title: z.string().optional().describe("New title if you want to rename the task"),
  }),
  // @ts-expect-error type inference mismatch
  execute: async ({ titleSearch, status, priority, title }) => {
    const { task, error } = await findUniqueTaskByTitle(titleSearch, { excludeDone: true })
    if (!task) return error

    // On completion, derive real actual time from scheduled sessions when
    // available instead of just copying the estimate.
    let actualMinutes: number | undefined
    let completedAt: Date | null | undefined
    if (status === "DONE") {
      actualMinutes =
        task.sessions.length > 0
          ? Math.round(
              task.sessions.reduce(
                (acc, s) => acc + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000,
                0
              )
            )
          : task.estimatedMinutes ?? undefined
      completedAt = new Date()
    } else if (status) {
      completedAt = null
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(title && { title }),
        ...(actualMinutes !== undefined && { actualMinutes }),
        ...(completedAt !== undefined && { completedAt }),
      },
    })

    return JSON.parse(JSON.stringify({ success: true, task: updated }))
  },
})

/**
 * Tool: moveTask
 * Reschedules a task to a new time.
 */
export const moveTask = tool({
  description:
    "Move or reschedule a task to a different date and time. Use this when the user says things like 'move X to tomorrow' or 'reschedule X to 3pm'.",
  parameters: z.object({
    titleSearch: z.string().describe("Part of the task title to search for"),
    startTime: z.string().describe(TIME_FIELD_DESCRIPTION),
    durationMinutes: z
      .number()
      .optional()
      .describe("New duration in minutes, if the user gave one. Otherwise the task's existing duration is kept."),
    endTime: z
      .string()
      .optional()
      .describe(`${TIME_FIELD_DESCRIPTION} Only set this if the user gave an explicit end time rather than a duration.`),
    confirmOverlap: CONFLICT_PARAM,
  }),
  // @ts-expect-error type inference mismatch
  execute: async ({ titleSearch, startTime, endTime, durationMinutes, confirmOverlap }) => {
    const { task, error } = await findUniqueTaskByTitle(titleSearch, { excludeDone: true })
    if (!task) return error

    const start = resolveDateTime(startTime)
    if (!start) {
      return {
        success: false,
        message: `I couldn't understand the time "${startTime}". Ask the user to clarify (e.g. "10pm today").`,
      }
    }

    let end: Date | null
    if (endTime) {
      end = resolveDateTime(endTime)
      if (!end) {
        return { success: false, message: `I couldn't understand the end time "${endTime}". Ask the user to clarify.` }
      }
    } else {
      end = addMinutes(start, durationMinutes ?? task.estimatedMinutes ?? 60)
    }

    if (end.getTime() <= start.getTime()) {
      return { success: false, message: "The end time must be after the start time. Ask the user to clarify." }
    }

    const conflicts = await findOverlappingTasks(start, end, task.id)
    if (conflicts.length > 0 && !confirmOverlap) {
      return {
        success: false,
        conflict: true,
        message: `That time slot overlaps with ${conflicts.length} existing task(s). Ask the user to confirm before double-booking.`,
        conflictingTasks: summarizeConflicts(conflicts),
      }
    }

    // Replace any existing session blocks with the single new time - chat
    // doesn't support specifying multiple blocks, so "move X to 3pm" means
    // the task now lives at exactly one place, not many. This also keeps
    // Task.startTime/endTime and TaskSession in sync so the calendar (which
    // prefers sessions when present) actually reflects the move.
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        startTime: start,
        endTime: end,
        estimatedMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
        sessions: { deleteMany: {}, create: [{ startTime: start, endTime: end }] },
      },
    })

    return JSON.parse(JSON.stringify({ success: true, task: updated }))
  },
})

/**
 * Tool: deleteTask
 * Permanently removes a task. Also what powers "undo" via chat, since
 * without this the assistant had no way to remove anything it (or the
 * user) created.
 */
export const deleteTask = tool({
  description:
    "Permanently delete a task. Use this when the user asks to remove, delete, cancel, or undo the creation of a task.",
  parameters: z.object({
    titleSearch: z.string().describe("Part of the task title to search for"),
  }),
  // @ts-expect-error type inference mismatch
  execute: async ({ titleSearch }) => {
    const { task, error } = await findUniqueTaskByTitle(titleSearch)
    if (!task) return error

    await prisma.task.delete({ where: { id: task.id } })
    return { success: true, deletedTitle: task.title }
  },
})

/**
 * Tool: searchTasks
 * Searches tasks by keyword, date range, or status.
 */
export const searchTasks = tool({
  description:
    "Search and retrieve tasks from the database. Use this to answer questions like 'What was I doing last Thursday?', 'Show my incomplete tasks', or 'What did I work on this week?'.",
  parameters: z.object({
    keyword: z.string().optional().describe("Keyword to search in task titles"),
    status: z
      .enum(["TODO", "IN_PROGRESS", "DONE", "ALL"])
      .optional()
      .default("ALL")
      .describe("Filter by task status"),
    startDate: z
      .string()
      .optional()
      .describe("ISO 8601 date to start the search range (inclusive)"),
    endDate: z.string().optional().describe("ISO 8601 date to end the search range (inclusive)"),
    limit: z.number().optional().default(10).describe("Max number of tasks to return"),
  }),
  // @ts-expect-error type inference mismatch
  execute: async ({ keyword, status, startDate, endDate, limit }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (keyword) {
      where.title = { contains: keyword }
    }
    if (status && status !== "ALL") {
      where.status = status
    }
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return JSON.parse(JSON.stringify({ tasks, count: tasks.length }))
  },
})

/**
 * Tool: dailySummary
 * Summarises what the user did today.
 */
export const dailySummary = tool({
  description:
    "Generate a summary of the user's day. Fetches today's completed and incomplete tasks and returns structured data for a summary.",
  parameters: z.object({}),
  // @ts-expect-error type inference mismatch
  execute: async () => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const [completed, incomplete, total] = await Promise.all([
      prisma.task.findMany({
        where: { status: "DONE", updatedAt: { gte: startOfDay, lte: endOfDay } },
      }),
      prisma.task.findMany({
        where: { status: { not: "DONE" } },
        orderBy: { priority: "desc" },
        take: 10,
      }),
      prisma.task.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
    ])

    return {
      date: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      completed: completed.map((t) => t.title),
      incomplete: incomplete.map((t) => ({ title: t.title, priority: t.priority })),
      completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
      totalCreatedToday: total,
    }
  },
})

/**
 * Tool: planTomorrow
 * Schedules pending, not-yet-scheduled tasks into tomorrow's open time slots.
 */
export const planTomorrow = tool({
  description:
    "Plan tomorrow's schedule. Takes pending tasks that don't already have a scheduled time (highest priority first) and places them into open slots starting from work hours tomorrow, skipping past anything already booked instead of double-booking it.",
  parameters: z.object({
    workStartHour: z
      .number()
      .default(9)
      .describe("Hour (24h) to start scheduling from, e.g. 9 for 9am"),
  }),
  // @ts-expect-error type inference mismatch
  execute: async ({ workStartHour }) => {
    // Only tasks with no time at all - anything already scheduled (e.g. a
    // fixed appointment saved as a normal task) is left alone rather than
    // silently clobbered with a new slot.
    const pendingTasks = await prisma.task.findMany({
      where: { status: { not: "DONE" }, startTime: null },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 8,
    })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(workStartHour, 0, 0, 0)

    const dayEnd = new Date(tomorrow)
    dayEnd.setHours(23, 0, 0, 0)

    const schedule: Array<{ task: string; start: string; end: string }> = []
    const skipped: string[] = []
    let cursor = new Date(tomorrow)

    for (const task of pendingTasks) {
      const durationMs = (task.estimatedMinutes || 60) * 60 * 1000
      let start = new Date(cursor)
      let end = new Date(start.getTime() + durationMs)

      // Nudge past anything already occupying this slot rather than
      // scheduling directly on top of it (this is the check that was
      // missing entirely before - createTask/moveTask already had it).
      for (let attempts = 0; attempts < 10; attempts++) {
        const conflicts = await findOverlappingTasks(start, end)
        if (conflicts.length === 0) break
        const ends = conflicts.map((c) => c.endTime).filter((d): d is Date => d !== null)
        const latestEnd = ends.length > 0 ? new Date(Math.max(...ends.map((d) => new Date(d).getTime()))) : end
        start = new Date(latestEnd.getTime() + 15 * 60000)
        end = new Date(start.getTime() + durationMs)
      }

      if (start.getTime() >= dayEnd.getTime()) {
        skipped.push(task.title)
        continue
      }

      await prisma.task.update({
        where: { id: task.id },
        data: { startTime: start, endTime: end },
      })

      schedule.push({
        task: task.title,
        start: start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        end: end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      })

      // Add a 15-minute break between tasks
      cursor = new Date(end.getTime() + 15 * 60 * 1000)
    }

    return { schedule, skipped, date: tomorrow.toDateString() }
  },
})

/**
 * Tool: analyzeSchedule
 * Analyzes the user's schedule for a specific date and calculates free time blocks.
 */
export const analyzeSchedule = tool({
  description:
    "Analyze the user's schedule for a specific date to find free time blocks. Use this when the user asks 'when am I free today', 'what time am I available', or 'do I have free time tomorrow'.",
  parameters: z.object({
    date: z.string().describe("ISO 8601 date string for the day to analyze (e.g. today's date)"),
    startHour: z.number().default(9).describe("Start hour of the work day (0-23, default 9)"),
    endHour: z.number().default(18).describe("End hour of the work day (0-23, default 18)"),
  }),
  // @ts-expect-error type inference mismatch
  execute: async ({ date, startHour, endHour }) => {
    // A bare "YYYY-MM-DD" is parsed by `new Date()` as UTC midnight, not
    // local midnight - for negative UTC-offset timezones that silently
    // shifts the analyzed day back by one. Parse the date parts explicitly.
    const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
    const targetDate = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
      : new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // Overlap query (not just "starts within the day") so a task spanning
    // midnight into the target day is still counted as busy time.
    const tasks = await prisma.task.findMany({
      where: {
        startTime: { not: null, lt: nextDay },
        endTime: { not: null, gt: targetDate },
      },
      orderBy: { startTime: "asc" },
    })

    const freeBlocks: Array<{ start: string; end: string; durationMinutes: number }> = []

    let currentTime = new Date(targetDate)
    currentTime.setHours(startHour, 0, 0, 0)
    const dayEnd = new Date(targetDate)
    dayEnd.setHours(endHour, 0, 0, 0)

    for (const task of tasks) {
      if (!task.startTime || !task.endTime) continue

      // If the task is before the work day starts, or ends before current time, skip
      if (task.endTime <= currentTime) continue

      if (task.startTime > currentTime) {
        const duration = Math.round((task.startTime.getTime() - currentTime.getTime()) / 60000)
        if (duration > 0) {
          freeBlocks.push({
            start: currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            end: task.startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            durationMinutes: duration,
          })
        }
      }
      if (task.endTime > currentTime) {
        currentTime = task.endTime
      }
    }

    if (currentTime < dayEnd) {
      const duration = Math.round((dayEnd.getTime() - currentTime.getTime()) / 60000)
      if (duration > 0) {
        freeBlocks.push({
          start: currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          end: dayEnd.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          durationMinutes: duration,
        })
      }
    }

    return {
      date: targetDate.toDateString(),
      scheduledTasksCount: tasks.length,
      freeBlocks
    }
  },
})
