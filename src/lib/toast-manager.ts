import { createToastManager } from "@/components/ui/toast"

// A single external manager so toasts can be fired from anywhere (mutation
// callbacks, event handlers) without needing to be inside the component
// that renders the toast list.
export const taskToastManager = createToastManager()
