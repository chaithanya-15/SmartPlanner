import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Task, TaskSession } from "@prisma/client"

export type TaskWithSessions = Task & {
  sessions?: TaskSession[]
}

export type ConflictInfo = {
  title: string
  startTime: string | Date
  endTime: string | Date
}

export class ConflictError extends Error {
  conflictingTasks: ConflictInfo[]
  constructor(message: string, conflictingTasks: ConflictInfo[]) {
    super(message)
    this.name = "ConflictError"
    this.conflictingTasks = conflictingTasks
  }
}

async function parseTaskResponse(res: Response) {
  if (res.status === 409) {
    const data = await res.json()
    throw new ConflictError(data.message || "Scheduling conflict", data.conflictingTasks || [])
  }
  if (!res.ok) throw new Error("Request failed")
  return res.json()
}

type CreateTaskInput = Partial<Omit<Task, "id" | "createdAt" | "updatedAt">> & {
  sessions?: { startTime: string | Date; endTime: string | Date }[]
  confirmOverlap?: boolean
}

export function useTasks(start?: string, end?: string) {
  const queryClient = useQueryClient()

  const tasksQuery = useQuery({
    queryKey: ["tasks", { start, end }],
    queryFn: async () => {
      let url = "/api/tasks"
      if (start && end) {
        url += `?start=${start}&end=${end}`
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch tasks")
      return res.json() as Promise<TaskWithSessions[]>
    },
  })

  const createTask = useMutation({
    mutationFn: async (newTask: CreateTaskInput) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      })
      return parseTaskResponse(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const updateTask = useMutation({
    mutationFn: async (
      task: Omit<Partial<TaskWithSessions>, "sessions"> & {
        id: string
        sessions?: { startTime: string | Date; endTime: string | Date }[]
        confirmOverlap?: boolean
      }
    ) => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      })
      return parseTaskResponse(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete task")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  return {
    tasks: tasksQuery.data || [],
    isLoading: tasksQuery.isLoading,
    isError: tasksQuery.isError,
    createTask,
    updateTask,
    deleteTask,
  }
}
