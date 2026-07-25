"use client"

import { useState, useEffect } from "react"
import { useTasks, ConflictError, ConflictInfo } from "@/hooks/use-tasks"
import { useUIStore } from "@/hooks/use-ui-store"
import { taskToastManager } from "@/lib/toast-manager"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, CalendarClock, AlertTriangle } from "lucide-react"

type SessionRow = { id: string, startTime: string, endTime: string }

// YYYY-MM-DDTHH:mm, for <input type="datetime-local">
const toLocalString = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateTaskModal() {
  const { isTaskModalOpen, closeCreateTaskModal, createTaskDefaults, editingTask } = useUIStore()
  const { createTask, updateTask, deleteTask } = useTasks()
  const isEditing = !!editingTask

  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [conflict, setConflict] = useState<ConflictInfo[] | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // A conflict check only reflects the times shown when it fired - if the
  // user then edits a field, "Schedule anyway" would otherwise bypass
  // validation for times the server never actually checked. Clear it so any
  // further submit re-validates against the current (edited) values.
  const invalidateStaleConflict = () => {
    if (conflict) setConflict(null)
  }

  useEffect(() => {
    if (!isTaskModalOpen) return
    setConflict(null)
    setConfirmingDelete(false)
    setFormError(null)

    if (editingTask) {
      setTitle(editingTask.title)
      setPriority(editingTask.priority)
      const existingSessions = editingTask.sessions || []
      if (existingSessions.length > 0) {
        setSessions(existingSessions.map(s => ({
          id: s.id,
          startTime: toLocalString(new Date(s.startTime)),
          endTime: toLocalString(new Date(s.endTime)),
        })))
      } else if (editingTask.startTime && editingTask.endTime) {
        setSessions([{
          id: Math.random().toString(),
          startTime: toLocalString(new Date(editingTask.startTime)),
          endTime: toLocalString(new Date(editingTask.endTime)),
        }])
      } else {
        setSessions([])
      }
    } else {
      setTitle("")
      setPriority("MEDIUM")
      if (createTaskDefaults.startTime && createTaskDefaults.endTime) {
        setSessions([{
          id: Math.random().toString(),
          startTime: createTaskDefaults.startTime.slice(0, 16),
          endTime: createTaskDefaults.endTime.slice(0, 16)
        }])
      } else {
        setSessions([])
      }
    }
  }, [isTaskModalOpen, createTaskDefaults, editingTask])

  const addSession = () => {
    invalidateStaleConflict()
    const now = new Date()
    now.setMinutes(0, 0, 0)
    const nextHour = new Date(now.getTime() + 60 * 60000)

    setSessions([...sessions, {
      id: Math.random().toString(),
      startTime: toLocalString(now),
      endTime: toLocalString(nextHour)
    }])
  }

  const removeSession = (id: string) => {
    invalidateStaleConflict()
    setSessions(sessions.filter(s => s.id !== id))
  }

  const updateSession = (id: string, field: "startTime"|"endTime", value: string) => {
    invalidateStaleConflict()
    setSessions(sessions.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const buildPayload = (confirmOverlap: boolean) => {
    let totalMinutes = 30 // default if no sessions
    if (sessions.length > 0) {
      totalMinutes = sessions.reduce((acc, s) => {
        const start = new Date(s.startTime).getTime()
        const end = new Date(s.endTime).getTime()
        return acc + Math.max(0, (end - start) / 60000)
      }, 0)
    }

    return {
      title,
      priority,
      estimatedMinutes: totalMinutes,
      sessions: sessions.map(s => ({
        startTime: new Date(s.startTime).toISOString(),
        endTime: new Date(s.endTime).toISOString()
      })),
      confirmOverlap,
    }
  }

  const handleSuccess = () => {
    closeCreateTaskModal()
    setTitle("")
    setPriority("MEDIUM")
    setSessions([])
  }

  const handleSubmit = (e: React.FormEvent, confirmOverlap = false) => {
    e.preventDefault()
    setConflict(null)
    setFormError(null)

    const invertedBlock = sessions.find((s) => new Date(s.endTime).getTime() <= new Date(s.startTime).getTime())
    if (invertedBlock) {
      setFormError("A time block's end time must be after its start time.")
      return
    }

    const onError = (err: Error) => {
      if (err instanceof ConflictError) {
        setConflict(err.conflictingTasks)
      } else {
        setFormError(err.message || "Something went wrong saving this task. Please try again.")
      }
    }

    if (isEditing && editingTask) {
      updateTask.mutate(
        { id: editingTask.id, status: editingTask.status, ...buildPayload(confirmOverlap) },
        { onSuccess: handleSuccess, onError }
      )
    } else {
      createTask.mutate(
        { status: "TODO", ...buildPayload(confirmOverlap) },
        {
          onSuccess: (created) => {
            handleSuccess()
            taskToastManager.add({
              title: "Task created",
              description: created?.title ?? title,
              timeout: 8000,
              actionProps: {
                children: "Undo",
                onClick: () => {
                  if (created?.id) deleteTask.mutate(created.id)
                },
              },
            })
          },
          onError,
        }
      )
    }
  }

  const handleDelete = () => {
    if (!editingTask) return
    deleteTask.mutate(editingTask.id, { onSuccess: handleSuccess })
  }

  const isPending = createTask.isPending || updateTask.isPending

  return (
    <Dialog open={isTaskModalOpen} onOpenChange={(open) => !open && closeCreateTaskModal()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            {isEditing ? "Edit Task" : "Create Task"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title</Label>
              <Input id="title" value={title} onChange={e => { invalidateStaleConflict(); setTitle(e.target.value) }} placeholder="What needs to be done?" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High Priority</SelectItem>
                  <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                  <SelectItem value="LOW">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-muted-foreground">Time Blocks (Optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSession}>
                <Plus className="w-4 h-4 mr-1" /> Add Block
              </Button>
            </div>

            <div className="space-y-3">
              {sessions.length === 0 && (
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md text-center border border-dashed">
                  No time blocks scheduled. Task will be floating.
                </div>
              )}
              {sessions.map((session) => (
                <div key={session.id} className="flex gap-2 items-end animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Start Time</Label>
                    <Input type="datetime-local" value={session.startTime} onChange={e => updateSession(session.id, "startTime", e.target.value)} required />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">End Time</Label>
                    <Input type="datetime-local" value={session.endTime} onChange={e => updateSession(session.id, "endTime", e.target.value)} required />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeSession(session.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{formError}</p>
            </div>
          )}

          {conflict && (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex gap-2 text-amber-500">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">
                  This overlaps with {conflict.length} existing task{conflict.length > 1 ? "s" : ""}:
                </p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 pl-6">
                {conflict.map((c, i) => (
                  <li key={i}>
                    {c.title} ({new Date(c.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - {new Date(c.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setConflict(null)}>
                  Change time
                </Button>
                <Button type="button" size="sm" className="flex-1" onClick={(e) => handleSubmit(e, true)}>
                  Schedule anyway
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {isEditing && !confirmingDelete && (
              <Button type="button" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            {isEditing && confirmingDelete && (
              <>
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteTask.isPending}>
                  {deleteTask.isPending ? "Deleting..." : "Confirm Delete"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </>
            )}
            {!confirmingDelete && (
              <Button type="submit" className="flex-1 font-semibold" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save Changes" : "Save Task"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
