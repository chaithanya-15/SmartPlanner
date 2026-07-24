# Project FAQ

Comprehensive questions and answers covering every aspect of this project.

---

## General

**Q: What is this application?**
A: Smart Planner is a personal productivity and scheduling tool. It lets you create tasks, schedule them into specific time blocks on a visual calendar, and interact with a local assistant to manage your workday — all running entirely on your own machine with no data sent to external servers.

**Q: Is my data stored in the cloud?**
A: No. All data is stored in a local SQLite database file (`prisma/dev.db`) on your machine. The language model also runs locally via Ollama. Nothing leaves your computer.

**Q: What technologies does this project use?**
A: Next.js 15 (App Router), React, TypeScript, Prisma ORM v7, SQLite via libSQL/Turso adapter, FullCalendar, Zustand, TanStack Query, shadcn/ui (Base UI components), and Ollama for local language model inference.

---

## Database

**Q: Where is the database stored?**
A: `prisma/dev.db` — a SQLite file in the project root.

**Q: What tables exist?**
A: The schema has these models:
- `Task` — the main task record with title, status, priority, estimated minutes, etc.
- `TaskSession` — a scheduled time block belonging to a task (start time, end time).
- `Project` — a grouping for tasks.
- `Conversation` — chat message history for the assistant.

**Q: Can I inspect the database?**
A: Yes. Run `npx prisma studio` in the project directory. It opens a browser-based GUI for viewing and editing all records.

**Q: How do I reset the database?**
A: Delete `prisma/dev.db` and run `npx prisma db push` to recreate a blank database.

**Q: How do I add a new field to the database?**
A: Edit `prisma/schema.prisma`, add the field, then run `npx prisma db push` to apply the change. Run `npx prisma generate` afterward to update the TypeScript client types.

---

## Tasks and Time Blocking

**Q: What is the difference between a Task and a TaskSession?**
A: A `Task` is the logical unit of work (e.g., "Write project report"). A `TaskSession` is a specific block of time on the calendar assigned to that task (e.g., Tuesday 9:00 - 11:00). A single task can have multiple sessions across different days.

**Q: What happens if I create a task with no time blocks?**
A: The task is created as a "floating" task. It will appear in the Today's Tasks list on the dashboard but will not show on the calendar until you assign at least one time block.

**Q: How are task colors on the calendar determined?**
A: Colors are assigned automatically based on priority and status:
- Indigo: default / medium priority
- Red: high priority
- Green: completed tasks

**Q: Can I drag and resize task blocks on the calendar?**
A: Yes. You can drag a block to move it and drag its bottom edge to resize it. Changes are saved automatically to the database.

**Q: Can I add a task directly from the calendar?**
A: Yes. Click and drag on any empty time slot in the calendar. The task creation modal will open with the start and end times pre-filled from your selection.

**Q: Can one task be split across multiple days?**
A: Yes. In the task creation modal, click "Add Block" multiple times and set different dates and times for each block. Each block represents an independent session.

---

## Focus Hours

**Q: How is "Focus Hours" on the dashboard calculated?**
A: Focus Hours is derived from real app usage, not your schedule. A separate background script (`scripts/track-usage.mjs`, started with `npm run track`) samples whichever window is actually in the foreground (on screen) every 15 seconds and records it to the local database; the dashboard sums that up per hour. Having an app open but not focused (e.g. this planner running in another tab while you work elsewhere) does not count — only the window you're actually looking at does. The tracker also separately records other running processes as "background" (seen, but not counted as focus time). This is opt-in: nothing is tracked unless you run `npm run track` yourself, and it never leaves your machine.

**Q: The focus hours / Focus by Hour chart show no data. Why?**
A: The tracker script isn't running. Open a terminal in the project folder and run `npm run track` while you work — the dashboard will start showing real data from the samples it collects. The first run may prompt for a one-time OS permission on some systems (e.g. macOS Screen Recording/Accessibility); Windows and Linux normally don't require anything extra.

---

## Assistant (Smart Assistant)

**Q: What can the assistant do?**
A: It can:
- Create tasks from a natural language description
- Mark tasks as complete or change their priority
- Move a task to a different time
- Search your tasks by keyword, date, or status
- Summarize what you completed today
- Help plan tomorrow's schedule

**Q: What happens if I ask the assistant something unrelated to scheduling?**
A: The assistant will politely decline and explain that it only handles topics related to this application — tasks, scheduling, and productivity.

**Q: Does the assistant use the internet?**
A: No. It runs entirely through Ollama, which runs locally on your machine. No internet connection is required for the assistant to work.

**Q: Which model does the assistant use?**
A: `llama3.2` via Ollama. You must have Ollama installed and the model downloaded (`ollama pull llama3.2`) for the assistant to function.

**Q: Can the assistant see my full conversation history?**
A: Yes, but securely. The conversation history is loaded from the database on the server side only. The client never sends history to the API — only the latest message is sent. This prevents history tampering or injection via the client payload.

**Q: Is the assistant protected from prompt injection?**
A: Yes, via multiple layers:
1. The system prompt instructs the model not to execute tool calls based on quoted text from users.
2. Incoming messages are sanitized to strip known injection patterns (`system:`, `[INST]`, `<<SYS>>`).
3. Messages are capped at 2000 characters to prevent excessively long injections.

---

## Setup and Running

**Q: How do I start the application in development mode?**
A: Run `npm run dev` from the project directory. Open `http://localhost:3000` in your browser.

**Q: Why does the assistant not respond?**
A: Ensure Ollama is running (`ollama serve`) and the model is downloaded (`ollama pull llama3.2`). The app connects to Ollama at `http://127.0.0.1:11434`.

**Q: How do I apply schema changes after editing `schema.prisma`?**
A: Run:
```
npx prisma db push
npx prisma generate
```

**Q: What port does the app run on?**
A: Port 3000 by default (`http://localhost:3000`).

---

## Architecture

**Q: Why SQLite and not PostgreSQL or another database?**
A: SQLite requires no external server and stores everything in a single file, making it ideal for a personal, local-first application. If you want to use a hosted database in the future, Prisma makes it straightforward to switch the provider.

**Q: Why is Prisma v7 used instead of v6?**
A: Prisma v7 introduced a mandatory driver adapter pattern that allows switching database drivers without changing ORM code. The `@prisma/adapter-libsql` adapter is used here, which supports both local SQLite files and hosted Turso databases.

**Q: Why is the modal state managed with Zustand?**
A: The "Create Task" modal needs to be triggered from two separate locations — the dashboard and the calendar page. Placing the modal state in a global Zustand store (`useUIStore`) and mounting the modal once in `layout.tsx` allows any page to open it without prop drilling or duplicated component instances.

**Q: What is TanStack Query used for?**
A: It handles all server-state management — caching API responses, re-fetching after mutations, and invalidating stale data. When you create or update a task, TanStack Query automatically re-fetches the task list so the UI stays in sync without a page reload.
