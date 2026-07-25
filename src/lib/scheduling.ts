import { prisma } from "@/lib/prisma"

/**
 * Finds active (non-DONE) tasks whose scheduled time overlaps the given range.
 * `excludeTaskId` skips the task being moved/edited so it doesn't conflict with itself.
 * Shared by the AI chat tools (src/tools/index.ts) and the REST API (/api/tasks)
 * so both surfaces enforce the same "don't double-book" rule.
 *
 * A task's `startTime`/`endTime` are the OUTER bounds of all its scheduled
 * sessions (e.g. a 9-10am block and an 8-9pm block on the same task give
 * startTime=9am, endTime=9pm). Checking against that envelope alone would
 * falsely flag any other task scheduled in the gap between blocks (e.g.
 * 2-3pm) as a conflict. So: tasks that have real session rows are checked
 * against those actual blocks, and only tasks with no sessions at all fall
 * back to their plain startTime/endTime.
 */
export async function findOverlappingTasks(start: Date, end: Date, excludeTaskId?: string) {
  const [sessionConflicts, plainConflicts] = await Promise.all([
    prisma.task.findMany({
      where: {
        id: excludeTaskId ? { not: excludeTaskId } : undefined,
        status: { not: "DONE" },
        sessions: { some: { startTime: { lt: end }, endTime: { gt: start } } },
      },
    }),
    prisma.task.findMany({
      where: {
        id: excludeTaskId ? { not: excludeTaskId } : undefined,
        status: { not: "DONE" },
        sessions: { none: {} },
        startTime: { not: null, lt: end },
        endTime: { not: null, gt: start },
      },
    }),
  ])

  const byId = new Map<string, (typeof sessionConflicts)[number]>()
  for (const t of [...sessionConflicts, ...plainConflicts]) byId.set(t.id, t)
  return Array.from(byId.values())
}

export function summarizeConflicts(conflicts: Awaited<ReturnType<typeof findOverlappingTasks>>) {
  return conflicts.map((t) => ({
    id: t.id,
    title: t.title,
    startTime: t.startTime,
    endTime: t.endTime,
  }))
}
