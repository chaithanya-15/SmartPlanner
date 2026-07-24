#!/usr/bin/env node
/**
 * Real app-usage tracker behind the dashboard's "Focus Hours" feature.
 *
 * Every POLL_INTERVAL_SECONDS it records whichever window is actually in
 * the foreground (on screen, what you're looking at) as a "foreground"
 * sample - that's the only thing that counts as focus time. Having this app
 * (or anything else) merely open in the background never counts, because
 * only the foreground window is ever sampled as "foreground".
 *
 * Every BACKGROUND_INTERVAL_SECONDS it separately snapshots the list of
 * other running processes as "background" samples, purely as a "what else
 * was open" record - this is NOT focus time, just presence.
 *
 * Run in its own terminal while you work: `npm run track` (Ctrl+C to stop).
 *
 * Requires `active-win` and `ps-list`, which are declared in package.json
 * but were not installed from this build - run `npm install` once first.
 *
 * First run may need a one-time OS permission grant:
 *  - macOS: System Settings -> Privacy & Security -> Screen Recording (and/or Accessibility)
 *  - Windows/Linux: no special permission is normally required.
 */
import path from "path"
import { randomUUID } from "crypto"
import { createClient } from "@libsql/client"

const POLL_INTERVAL_SECONDS = 15 // keep in sync with src/app/api/usage/route.ts
const BACKGROUND_INTERVAL_SECONDS = 60

const dbPath = path.resolve(process.cwd(), "dev.db")
const client = createClient({ url: `file:${dbPath}` })

async function insertSample(appName, windowTitle, kind) {
  await client.execute({
    sql: "INSERT INTO UsageSample (id, appName, windowTitle, kind, timestamp) VALUES (?, ?, ?, ?, datetime('now'))",
    args: [randomUUID(), appName, windowTitle ?? null, kind],
  })
}

async function pollForeground() {
  try {
    const { default: activeWin } = await import("active-win")
    const win = await activeWin()
    if (win?.owner?.name) {
      await insertSample(win.owner.name, win.title, "foreground")
      console.log(`[foreground] ${win.owner.name}${win.title ? " - " + win.title : ""}`)
    }
  } catch (err) {
    console.error("[track-usage] foreground poll failed:", err instanceof Error ? err.message : err)
  }
}

async function pollBackground() {
  try {
    const { default: psList } = await import("ps-list")
    const processes = await psList()
    const seen = new Set()
    for (const p of processes) {
      if (!p.name || seen.has(p.name)) continue
      seen.add(p.name)
      await insertSample(p.name, undefined, "background")
    }
    console.log(`[background] recorded ${seen.size} running processes`)
  } catch (err) {
    console.error("[track-usage] background poll failed:", err instanceof Error ? err.message : err)
  }
}

console.log(
  `Tracking usage into ${dbPath} - foreground every ${POLL_INTERVAL_SECONDS}s, background every ${BACKGROUND_INTERVAL_SECONDS}s. Ctrl+C to stop.`
)
pollForeground()
pollBackground()
setInterval(pollForeground, POLL_INTERVAL_SECONDS * 1000)
setInterval(pollBackground, BACKGROUND_INTERVAL_SECONDS * 1000)
