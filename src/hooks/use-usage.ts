import { useQuery } from "@tanstack/react-query"

export interface UsageData {
  date: string
  totalMinutes: number
  hourlyMinutes: number[]
  topApps: { app: string, minutes: number }[]
  backgroundApps: { app: string, lastSeen?: string }[]
  hasData: boolean
}

// Real, system-usage-derived focus data (from scripts/track-usage.mjs),
// as opposed to the old "sum of scheduled time blocks" approximation.
export function useUsage(date?: string) {
  return useQuery({
    queryKey: ["usage", date],
    queryFn: async () => {
      const url = date ? `/api/usage?date=${date}` : "/api/usage"
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch usage")
      return res.json() as Promise<UsageData>
    },
    refetchInterval: 60000,
  })
}
