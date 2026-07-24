# Smart Planner

A personal, local-first productivity app: a visual calendar, task management, a productivity report, and a natural-language assistant for managing your schedule — all running on your own machine. No cloud accounts, no subscriptions, and (aside from the optional local model) no data ever leaves your computer.

## Features

- **Dashboard** — today's tasks and an overdue list (separated so a task from yesterday never gets mistaken for something due today), completion rate, and real focus-hours tracking.
- **Calendar** — drag to create a time block, drag/resize to reschedule, click an event to edit or delete it. Anything that would double-book an existing task asks for confirmation before saving.
- **Tasks** — create, edit, and delete tasks, with optional multiple time blocks per task (split one task across several sessions/days) editable at any time, not just at creation.
- **Productivity page** — a weekly report: completed vs. pending, time logged per task, a completion trend across the last 6 weeks, and a full task list for the week.
- **AI Assistant** — a locally-running Ollama model that can create/move/update tasks, summarize your day, plan tomorrow, and find free time, entirely through chat. It refuses to double-book a time slot without asking first.
- **Focus Hours** — real usage tracking (opt-in): a background script records whichever window is actually on screen, not just what's on your calendar. See [Usage Tracking](#usage-tracking) below.

## Tech Stack

Next.js 15 (App Router), TypeScript, Prisma v7 over SQLite (via the libSQL adapter), FullCalendar, TanStack Query, Zustand, Tailwind CSS v4 with shadcn/ui, and the Vercel AI SDK for streaming + tool calling against a local Ollama model.

## Getting Started

### Prerequisites

- Node.js 18+
- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- The `llama3.2` model pulled (`ollama pull llama3.2`)

### Setup

```bash
# Install dependencies
npm install

# Push the database schema and generate the Prisma client
npx prisma db push
npx prisma generate

# Start the dev server (also starts `ollama serve`)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Usage Tracking

Focus Hours and the "Focus by Hour" chart are driven by real app usage, not your schedule. To start recording it, run in a separate terminal while you work:

```bash
npm run track
```

This samples the foreground (on-screen) window every 15 seconds — an app merely open but not focused never counts — and separately records other running processes at a lower frequency, purely as a "seen in the background" list. Nothing is tracked unless you run this yourself, and it never leaves your machine. First run may prompt for a one-time OS permission on some systems (e.g. macOS Screen Recording/Accessibility); Windows and Linux normally need nothing extra.

## Documentation

- [`docs/project-details.md`](docs/project-details.md) — architecture, schema, and key design decisions.
- [`docs/faq.md`](docs/faq.md) — frequently asked questions.

## Security & Privacy

- No external API keys — the assistant runs entirely through a local Ollama model.
- The system prompt is generated server-side and never sent to the client.
- Incoming chat messages are sanitized and length-capped before processing.
- Usage tracking is opt-in, local-only, and only records the foreground window and a list of other running process names — never keystrokes, clipboard contents, or screen contents.
