"use client"

import { X } from "lucide-react"
import {
  Toast,
  ToastPortal,
  ToastViewport,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  useToastManager,
} from "@/components/ui/toast"
import { taskToastManager } from "@/lib/toast-manager"

function ToastList() {
  const { toasts } = useToastManager()
  return (
    <ToastPortal>
      <ToastViewport>
        {toasts.map((toast) => (
          <ToastRoot key={toast.id} toast={toast}>
            <div className="flex-1 space-y-0.5 min-w-0">
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
            </div>
            {toast.actionProps && <ToastAction {...toast.actionProps} />}
            <ToastClose>
              <X className="h-3.5 w-3.5" />
            </ToastClose>
          </ToastRoot>
        ))}
      </ToastViewport>
    </ToastPortal>
  )
}

// Mounted once at the root. Bound to the shared `taskToastManager` so any
// mutation callback anywhere in the app can call `taskToastManager.add(...)`
// without needing to be inside this provider's subtree.
export function Toaster() {
  return (
    <Toast toastManager={taskToastManager}>
      <ToastList />
    </Toast>
  )
}
