/**
 * Single source of truth for which local Ollama model powers the assistant,
 * so the chat page's displayed label can never drift from what route.ts
 * actually calls.
 */
export const OLLAMA_MODEL_ID = "llama3.2"
export const OLLAMA_MODEL_LABEL = "Llama 3.2"
