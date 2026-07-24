"use client"

import { useUsage } from "@/hooks/use-usage"

export function FocusByHourChart() {
  const { data, isLoading } = useUsage()

  if (isLoading) {
    return <div className="h-40 bg-muted/30 rounded-lg animate-pulse" />
  }

  if (!data?.hasData) {
    return (
      <div className="text-sm text-muted-foreground text-center py-10 border border-dashed rounded-lg space-y-2">
        <p>No real usage data yet.</p>
        <p>
          Run <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">npm run track</code> in a terminal while you work to start recording actual focus time from what&apos;s on your screen.
        </p>
      </div>
    )
  }

  const values = data.hourlyMinutes
  const max = Math.max(1, ...values)
  const width = 700
  const height = 140
  const barGap = 2
  const barWidth = (width - barGap * 23) / 24

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full h-auto">
        {values.map((v, hour) => {
          const barHeight = (v / max) * height
          const x = hour * (barWidth + barGap)
          const y = height - barHeight
          return (
            <g key={hour}>
              <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, v > 0 ? 2 : 0)} fill="hsl(var(--primary))" opacity={0.85} rx={2} />
              {hour % 3 === 0 && (
                <text x={x + barWidth / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="currentColor" opacity={0.5}>
                  {hour}:00
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {data.topApps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.topApps.slice(0, 6).map((a) => (
            <span key={a.app} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
              {a.app} · {a.minutes}m
            </span>
          ))}
        </div>
      )}
      {data.backgroundApps.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Also seen running in the background today: {data.backgroundApps.slice(0, 6).map((a) => a.app).join(", ")}
          {data.backgroundApps.length > 6 ? ` +${data.backgroundApps.length - 6} more` : ""}
        </p>
      )}
    </div>
  )
}
