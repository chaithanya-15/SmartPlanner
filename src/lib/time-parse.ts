/**
 * Deterministic, dependency-free resolver for the handful of time phrases the
 * assistant actually needs ("10pm today", "tomorrow 3:30pm", "in 30 minutes",
 * plain ISO strings). Local LLMs are unreliable at exact date arithmetic, so
 * instead of asking the model to compute an ISO timestamp itself, tools pass
 * the phrase through as-is and this resolves it against the real current time.
 * Returns null when the phrase can't be confidently resolved — callers should
 * treat that as "ask the user to clarify," never silently fall back to "now."
 */

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}/
const RELATIVE_MINUTES = /in\s+(\d+)\s*(minutes?|mins?)\b/i
const RELATIVE_HOURS = /in\s+(\d+)\s*(hours?|hrs?)\b/i
const TIME_12H = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
const TIME_24H = /\b([01]?\d|2[0-3]):([0-5]\d)\b/

export function resolveDateTime(input: string | undefined | null, now: Date = new Date()): Date | null {
  if (!input) return null
  const text = input.trim()
  if (!text) return null

  // Already a real ISO datetime — trust it directly.
  if (ISO_LIKE.test(text)) {
    const d = new Date(text)
    return isNaN(d.getTime()) ? null : d
  }

  const lower = text.toLowerCase()

  const minsMatch = lower.match(RELATIVE_MINUTES)
  if (minsMatch) return new Date(now.getTime() + parseInt(minsMatch[1], 10) * 60000)

  const hoursMatch = lower.match(RELATIVE_HOURS)
  if (hoursMatch) return new Date(now.getTime() + parseInt(hoursMatch[1], 10) * 3600000)

  const dayOffset = /\btomorrow\b/.test(lower) ? 1 : 0
  const base = new Date(now)
  base.setDate(base.getDate() + dayOffset)

  if (/\bnoon\b/.test(lower)) {
    base.setHours(12, 0, 0, 0)
    return base
  }
  if (/\bmidnight\b/.test(lower)) {
    base.setHours(0, 0, 0, 0)
    return base
  }

  const twelveMatch = lower.match(TIME_12H)
  if (twelveMatch) {
    let hour = parseInt(twelveMatch[1], 10) % 12
    const minute = twelveMatch[2] ? parseInt(twelveMatch[2], 10) : 0
    if (twelveMatch[3].toLowerCase() === "pm") hour += 12
    base.setHours(hour, minute, 0, 0)
    return base
  }

  const twentyFourMatch = lower.match(TIME_24H)
  if (twentyFourMatch) {
    base.setHours(parseInt(twentyFourMatch[1], 10), parseInt(twentyFourMatch[2], 10), 0, 0)
    return base
  }

  return null
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}
