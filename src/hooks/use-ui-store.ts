import { create } from "zustand"
import { TaskWithSessions } from "@/hooks/use-tasks"

interface UIState {
  isTaskModalOpen: boolean
  editingTask: TaskWithSessions | null
  createTaskDefaults: {
    startTime?: string
    endTime?: string
    estimatedMinutes?: number
  }
  openCreateTaskModal: (defaults?: { startTime?: string, endTime?: string, estimatedMinutes?: number }) => void
  openEditTaskModal: (task: TaskWithSessions) => void
  closeCreateTaskModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isTaskModalOpen: false,
  editingTask: null,
  createTaskDefaults: {},
  openCreateTaskModal: (defaults = {}) => set({ isTaskModalOpen: true, createTaskDefaults: defaults, editingTask: null }),
  openEditTaskModal: (task) => set({ isTaskModalOpen: true, editingTask: task, createTaskDefaults: {} }),
  closeCreateTaskModal: () => set({ isTaskModalOpen: false, createTaskDefaults: {}, editingTask: null }),
}))
