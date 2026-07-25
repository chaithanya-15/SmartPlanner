"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"

import { cn } from "@/lib/utils"

const Toast = ToastPrimitive.Provider
const useToastManager = ToastPrimitive.useToastManager
const createToastManager = ToastPrimitive.createToastManager

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 outline-none",
        className
      )}
      {...props}
    />
  )
}

function ToastRoot({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "pointer-events-auto flex items-start justify-between gap-3 rounded-xl border border-border bg-popover p-4 text-sm text-popover-foreground shadow-2xl ring-1 ring-foreground/10 transition-all duration-200 data-[transition-status=starting]:translate-x-4 data-[transition-status=starting]:opacity-0 data-[transition-status=ending]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("font-medium leading-none", className)}
      {...props}
    />
  )
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

function ToastAction({ className, ...props }: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(
        "shrink-0 rounded-md px-2 py-1 font-medium text-primary underline-offset-2 hover:underline",
        className
      )}
      {...props}
    />
  )
}

function ToastClose({ className, ...props }: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Dismiss"
      className={cn(
        "shrink-0 rounded-md px-1 text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Toast,
  ToastPortal,
  ToastViewport,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  useToastManager,
  createToastManager,
}
