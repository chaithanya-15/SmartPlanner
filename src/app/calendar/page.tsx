"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import { useTasks, ConflictError } from "@/hooks/use-tasks"
import { useUIStore } from "@/hooks/use-ui-store"
import { Card, CardContent } from "@/components/ui/card"

export default function CalendarPage() {
  const { tasks, updateTask } = useTasks()
  const { openCreateTaskModal, openEditTaskModal } = useUIStore()

  // Map tasks and sessions to FullCalendar events
  const events = tasks.flatMap((task) => {
    let color = "#6366f1" // indigo-500
    if (task.priority === "HIGH") color = "#ef4444" // red-500
    if (task.status === "DONE") color = "#10b981" // emerald-500

    const baseProps = {
      title: task.title,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        status: task.status,
        priority: task.priority,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (task.sessions && (task.sessions as any[]).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (task.sessions as any[]).map((session) => ({
        id: `${task.id}-${session.id}`,
        taskId: task.id,
        sessionId: session.id,
        start: new Date(session.startTime),
        end: new Date(session.endTime),
        ...baseProps
      }))
    }

    // Fallback for tasks without sessions
    const start = task.startTime ? new Date(task.startTime) : new Date(task.createdAt)
    const end = task.endTime ? new Date(task.endTime) : new Date(start.getTime() + (task.estimatedMinutes || 60) * 60000)

    return [{
      id: task.id,
      taskId: task.id,
      start,
      end,
      ...baseProps
    }]
  })

  // Drag/resize on the calendar talks straight to the API - there's no form
  // here to show an inline conflict panel, so a plain confirm() is the
  // pragmatic choice: on conflict, ask right there, and revert the visual
  // move/resize if the user backs out (otherwise the event would appear to
  // have moved even though nothing was actually saved).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rescheduleWithConflictConfirm = (taskId: string, data: Record<string, unknown>, onRevert: () => void) => {
    updateTask.mutate(
      { id: taskId, ...data },
      {
        onError: (err) => {
          if (err instanceof ConflictError) {
            const list = err.conflictingTasks
              .map((c) => `${c.title} (${new Date(c.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${new Date(c.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`)
              .join(", ")
            const proceed = window.confirm(`This overlaps with: ${list}. Schedule it anyway?`)
            if (proceed) {
              updateTask.mutate({ id: taskId, ...data, confirmOverlap: true }, { onError: onRevert })
            } else {
              onRevert()
            }
          } else {
            onRevert()
          }
        },
      }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventDrop = (info: any) => {
    // If it's a session, we'd ideally update just the session. For now, we fallback to updating task if no session.
    // Full session editing requires a new API endpoint, but we can do a simplified version here.
    const taskId = info.event.extendedProps.taskId || info.event.id
    rescheduleWithConflictConfirm(taskId, {
      startTime: info.event.start?.toISOString(),
      endTime: info.event.end?.toISOString(),
    }, () => info.revert())
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventResize = (info: any) => {
    const taskId = info.event.extendedProps.taskId || info.event.id
    rescheduleWithConflictConfirm(taskId, {
      startTime: info.event.start?.toISOString(),
      endTime: info.event.end?.toISOString(),
      estimatedMinutes: Math.round((info.event.end.getTime() - info.event.start.getTime()) / 60000)
    }, () => info.revert())
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelect = (info: any) => {
    const estimatedMinutes = Math.round((info.end.getTime() - info.start.getTime()) / 60000)
    openCreateTaskModal({
      startTime: info.startStr,
      endTime: info.endStr,
      estimatedMinutes
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (info: any) => {
    const taskId = info.event.extendedProps.taskId || info.event.id
    const task = tasks.find((t) => t.id === taskId)
    if (task) openEditTaskModal(task)
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent pb-1">Calendar</h1>
        <p className="text-muted-foreground mt-2 text-lg">Manage your schedule and time blocks.</p>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-card/40 backdrop-blur-xl border-white/10 shadow-2xl">
        <CardContent className="flex-1 p-0 relative">
          <div className="absolute inset-0 p-6 calendar-container">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "timeGridWeek,timeGridDay"
              }}
              events={events}
              editable={true}
              droppable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              eventClick={handleEventClick}
              select={handleSelect}
              height="100%"
              slotMinTime="06:00:00"
              slotMaxTime="24:00:00"
              allDaySlot={false}
              nowIndicator={true}
              slotDuration="00:30:00"
              snapDuration="00:15:00"
            />
          </div>
        </CardContent>
      </Card>

      <style jsx global>{`
        /* Premium UI Calendar Overrides */
        .calendar-container {
          --fc-border-color: hsl(var(--border) / 0.2);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: transparent;
          --fc-neutral-text-color: hsl(var(--foreground));
          --fc-today-bg-color: hsl(var(--primary) / 0.05);
        }
        
        .calendar-container .fc-theme-standard td, 
        .calendar-container .fc-theme-standard th {
          border-color: var(--fc-border-color);
        }

        /* Hide horizontal grid lines to keep the view clean as requested */
        .calendar-container .fc-timegrid-slot-lane {
          border-bottom: none !important;
        }
        .calendar-container .fc-timegrid-slot-minor {
          border-top: none !important;
        }

        /* Buttons */
        .calendar-container .fc-button-primary {
          background-color: hsl(var(--primary) / 0.9);
          border-color: transparent;
          color: hsl(var(--primary-foreground));
          border-radius: 0.5rem;
          font-weight: 600;
          text-transform: capitalize;
          transition: all 0.2s;
        }
        .calendar-container .fc-button-primary:not(:disabled):hover {
          background-color: hsl(var(--primary));
          box-shadow: 0 4px 12px hsl(var(--primary) / 0.3);
        }
        .calendar-container .fc-button-primary:not(:disabled):active,
        .calendar-container .fc-button-primary:not(:disabled).fc-button-active {
          background-color: hsl(var(--primary));
          border-color: transparent;
          transform: translateY(1px);
        }

        /* Event Blocks */
        .calendar-container .fc-timegrid-event {
          border-radius: 6px;
          border-width: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          opacity: 0.95;
        }
        .calendar-container .fc-timegrid-event:hover {
          transform: scale(1.02);
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
          z-index: 10 !important;
          opacity: 1;
        }
        .calendar-container .fc-event-main {
          padding: 4px 8px;
          font-weight: 500;
          font-size: 0.85rem;
        }

        /* Typography */
        .calendar-container .fc-col-header-cell-cushion {
          color: hsl(var(--foreground));
          font-weight: 600;
          padding: 8px;
        }
        .calendar-container .fc-timegrid-axis-cushion {
          font-weight: 500;
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  )
}
