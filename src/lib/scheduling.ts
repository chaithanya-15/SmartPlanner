import { prisma } from "@/lib/prisma"

/**
 * Finds active (non-DONE) tasks whose scheduled time overlaps the given range.
 * `excludeTaskId` skips the task being moved/edited so it doesn't conflict with itself.
 * Shared by the AI chat tools (src/tools/index.ts) and the REST API (/api/tasks)
 * so both surfaces enforce the same "don't double-book" rule.
 */
export async function findOverlappingTasks(start: Date, end: Date, excludeTaskId?: string) {
  return prisma.task.findMany({
    where: {
      id: excludeTaskId ? { not: excludeTaskId } : undefined,
      status: { not: "DONE" },
      startTime: { not: null, lt: end },
      endTime: { not: null, gt: start },
    },
  })
}

export function summarizeConflicts(conflicts: Awaited<ReturnType<typeof findOverlappingTasks>>) {
  return conflicts.map((t) => ({
    id: t.id,
    title: t.title,
    startTime: t.startTime,
    endTime: t.endTime,
  }))
}
