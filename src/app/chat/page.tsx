"use client"

import { useChat } from "@ai-sdk/react"
import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Send, Bot, Sparkles, User, Wrench, AlertCircle, Clock, Loader2 } from "lucide-react"
import { OLLAMA_MODEL_LABEL } from "@/lib/ai-config"

type ToolCallDisplay = {
  toolName: string
  state: "pending" | "done"
}

function ToolCallBadge({ toolName, state }: ToolCallDisplay) {
  const label: Record<string, string> = {
    createTask: "Creating task",
    updateTask: "Updating task",
    moveTask: "Moving task",
    searchTasks: "Searching tasks",
    dailySummary: "Summarising day",
    planTomorrow: "Planning tomorrow",
  }
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary w-fit">
      <Wrench className="h-3 w-3 shrink-0" />
      <span>{label[toolName] ?? toolName}</span>
      {state === "pending" && (
        <span className="ml-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}
      {state === "done" && <span className="ml-1 text-emerald-400 font-bold text-xs">done</span>}
    </div>
  )
}

type ToolInvocation = { toolName: string; state: string }

function MessageBubble({
  role,
  content,
  reasoning,
  toolInvocations,
}: {
  role: string
  content: string
  reasoning?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInvocations?: any[]
}) {
  const isUser = role === "user"

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full group py-4 px-2`}>
      <div className="flex gap-4 max-w-[85%]">
        {!isUser && (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-1">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        )}
        <div className={`flex flex-col gap-2 w-full ${isUser ? "items-end" : "items-start"}`}>
          {content && (
            <div
              className={`px-5 py-3.5 rounded-2xl relative ${
                isUser
                  ? "bg-primary text-primary-foreground rounded-tr-sm shadow-sm"
                  : "bg-card text-card-foreground border border-border rounded-tl-sm shadow-sm"
              }`}
            >
              <div className="leading-relaxed whitespace-pre-wrap">{content}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)

  const { messages, status, error, sendMessage } = useChat({})

  // Timer for AI thinking
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (status === "submitted" || status === "streaming") {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(interval)
  }, [status])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || status === "submitted" || status === "streaming") return
    setInputValue("")
    sendMessage({ text })
  }

  const suggestions = [
    "Create a high priority task to review PRs for 45 minutes",
    "What tasks did I complete today?",
    "Plan tomorrow's schedule",
    "Summarise my day",
  ]

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto px-4 pb-6">
      {/* Header */}
      <div className="py-6 border-b border-border mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Powered by {OLLAMA_MODEL_LABEL} · 100% local · Zero data sent externally
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1 py-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">What can I help you with?</p>
              <p className="text-sm text-muted-foreground">
                I can create tasks, update progress, search your history, and plan your day.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInputValue(s)
                  }}
                  className="text-left text-xs px-3 py-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = m as any
          const content = msg.content || (msg.parts || []).map((p: { text?: string }) => p.text ?? '').join('')
          const toolInvocations = msg.toolInvocations || (msg.parts || []).filter((p: { type: string }) => p.type === 'tool-invocation').map((p: { toolInvocation?: unknown }) => p.toolInvocation || p)
          return (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={content}
              reasoning={msg.reasoning}
              toolInvocations={toolInvocations}
            />
          )
        })}

        {(status === "submitted" || status === "streaming") && (
          <div className="flex justify-start px-2 py-4">
            <div className="flex items-center gap-2 text-muted-foreground bg-accent/20 px-4 py-2 rounded-2xl border border-border">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking... {elapsed}s</span>
            </div>
          </div>
        )}



        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {error.message.includes("fetch") || error.message.includes("network")
                ? "Cannot connect to Ollama. Make sure you have run: ollama serve"
                : error.message}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-end gap-3 pt-4 border-t border-border mt-2">
        <textarea
          className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[52px] max-h-32"
          placeholder="Ask me anything about your tasks..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={status === "submitted" || status === "streaming" || !inputValue.trim()}
          className="h-[52px] w-[52px] rounded-xl shrink-0 bg-primary hover:bg-primary/90"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
