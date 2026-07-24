# Smart Planner — Project Details

## Overview

Smart Planner is a personal, local-first productivity application. It combines a visual calendar scheduler with a task management system and an on-device language model assistant. Everything runs on your own machine — no cloud accounts, no subscriptions, no data leaving your computer.

---

## Goals

- Give you a single place to create tasks and schedule them into specific time blocks.
- Provide a visual calendar that shows your workload as solid, easy-to-read blocks of time.
- Enable natural-language interaction with your task list through a locally-running assistant.
- Remain private and secure: no third-party API keys required, no data sent externally.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 15 (App Router) | Full-stack React framework |
| Language | TypeScript | Type safety across the entire codebase |
| Database | SQLite (via libSQL) | Local file-based database |
| ORM | Prisma v7 | Type-safe database queries and migrations |
| DB Adapter | @prisma/adapter-libsql | Connects Prisma v7 to libSQL/SQLite |
| UI Components | shadcn/ui (Base UI) | Accessible, unstyled component primitives |
| CSS | Tailwind CSS v4 | Utility-first styling |
| Calendar | FullCalendar | Interactive time grid with drag-and-drop |
| State (server) | TanStack Query v5 | API caching, mutations, and re-fetching |
| State (client) | Zustand | Global UI state (e.g., modal open/close) |
| Language Model | Ollama (llama3.2) | Local inference, no internet required |
| AI SDK | Vercel AI SDK | Streaming responses and tool calling |

---

## Directory Structure

```
to-do/
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── prisma.config.ts    # Prisma v7 adapter configuration
│   └── dev.db              # SQLite database file (auto-created)
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout — sidebar, providers, global modal
│   │   ├── page.tsx                # Dashboard page
│   │   ├── calendar/
│   │   │   └── page.tsx            # Calendar page (FullCalendar)
│   │   ├── chat/
│   │   │   └── page.tsx            # Assistant chat page
│   │   └── api/
│   │       ├── tasks/
│   │       │   ├── route.ts        # GET all tasks, POST new task
│   │       │   └── [id]/route.ts   # PUT (update), DELETE task by ID
│   │       └── chat/
│   │           └── route.ts        # POST — streams response from Ollama
│   ├── components/
│   │   ├── create-task-modal.tsx   # Global task creation modal
│   │   ├── app-sidebar.tsx         # Navigation sidebar
│   │   ├── query-provider.tsx      # TanStack Query context
│   │   └── ui/                     # shadcn/ui component primitives
│   ├── hooks/
│   │   ├── use-tasks.ts            # TanStack Query hooks for task CRUD
│   │   └── use-ui-store.ts         # Zustand store for global UI state
│   ├── tools/
│   │   └── index.ts                # Tool definitions for the assistant
│   └── lib/
│       ├── prisma.ts               # Prisma client singleton
│       └── utils.ts                # Utility functions (cn, etc.)
└── docs/
    ├── error-log.md                # Build and runtime errors with solutions
    ├── faq.md                      # Frequently asked questions
    └── project-details.md          # This file
```

---

## Database Schema

### Task
The primary record for a unit of work.

| Field | Type | Notes |
|---|---|---|
| id | String | UUID, primary key |
| title | String | Task name |
| description | String? | Optional description |
| status | String | TODO, IN_PROGRESS, DONE |
| priority | String | LOW, MEDIUM, HIGH |
| startTime | DateTime? | Earliest session start (auto-set) |
| endTime | DateTime? | Latest session end (auto-set) |
| estimatedMinutes | Int? | Total estimated work duration |
| actualMinutes | Int? | Recorded time after completion |
| projectId | String? | Optional link to a Project |
| sessions | TaskSession[] | Relation: all scheduled time blocks |
| createdAt | DateTime | Auto timestamp |
| updatedAt | DateTime | Auto timestamp |

### TaskSession
A single scheduled block of time belonging to a Task.

| Field | Type | Notes |
|---|---|---|
| id | String | UUID, primary key |
| taskId | String | Foreign key to Task |
| startTime | DateTime | Block start |
| endTime | DateTime | Block end |

### Project
A grouping label for tasks.

| Field | Type | Notes |
|---|---|---|
| id | String | UUID, primary key |
| name | String | Project name |
| tasks | Task[] | Relation: all tasks in this project |

### Conversation
Persisted chat message history for the assistant.

| Field | Type | Notes |
|---|---|---|
| id | String | UUID, primary key |
| role | String | "user" or "assistant" |
| message | String | Message content |
| timestamp | DateTime | Auto timestamp |

---

## Key Architectural Decisions

### Global Modal Pattern
The "Create Task" modal is mounted once in `layout.tsx` at the root level. Its open/close state and pre-fill data live in a Zustand store (`useUIStore`). Any page — dashboard or calendar — simply calls `openCreateTaskModal()` to trigger it. This avoids duplicate modal instances and prop drilling.

### Prisma v7 Driver Adapter
Prisma v7 removed the ability to connect to a database purely through the `datasource` URL field when using a custom adapter. The adapter (`PrismaLibSql`) is configured in `prisma.config.ts` and is the sole connection point. The `schema.prisma` file contains no `url` field.

### Server-Side Conversation History
The chat API loads conversation history from the database on the server, not from the client request body. Only the latest user message is accepted from the client. This prevents a malicious actor from tampering with the conversation history or injecting fake system messages through the API.

### Focus Hours Calculation
Focus Hours displayed on the dashboard are derived from real app usage, sampled by the opt-in `scripts/track-usage.mjs` background poller (started with `npm run track`). It records whichever window is actually in the foreground every 15 seconds — an app merely open but not focused never counts — plus a lower-frequency snapshot of other running processes purely as a "seen in background" record. Nothing is tracked unless the script is run, and no usage data ever leaves your machine.

---

## Running the Project

### Prerequisites
- Node.js 18+
- Ollama installed and running (`ollama serve`)
- llama3.2 model downloaded (`ollama pull llama3.2`)

### Steps

```bash
# Install dependencies
npm install

# Push database schema and generate Prisma client
npx prisma db push
npx prisma generate

# Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Security Considerations

- The system prompt is hardcoded server-side and never exposed to the client.
- Incoming chat messages are sanitized to strip injection patterns.
- All messages are truncated to 2000 characters before processing.
- The assistant is instructed to refuse requests outside the scope of this application.
- The assistant is instructed not to use emojis, keeping responses clean and professional.
- No external API keys are used. The model runs locally via Ollama.
