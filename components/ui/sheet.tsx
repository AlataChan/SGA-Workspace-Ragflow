"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface SheetContentProps {
  side?: "left" | "right" | "top" | "bottom"
  className?: string
  children: React.ReactNode
}

interface SheetTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

interface SheetHeaderProps {
  className?: string
  children: React.ReactNode
}

interface SheetTitleProps {
  className?: string
  children: React.ReactNode
}

interface SheetDescriptionProps {
  className?: string
  children: React.ReactNode
}

const SheetContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({ open: false, setOpen: () => {} })

export function Sheet({ open: controlledOpen, onOpenChange, children }: SheetProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen

  const setOpen = React.useCallback((value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value)
    } else {
      setInternalOpen(value)
    }
  }, [onOpenChange])

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  )
}

export function SheetTrigger({ asChild, children }: SheetTriggerProps) {
  const { setOpen } = React.useContext(SheetContext)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        setOpen(true)
        const originalOnClick = (children as React.ReactElement<any>).props.onClick
        if (originalOnClick) originalOnClick(e)
      }
    })
  }

  return (
    <button onClick={() => setOpen(true)}>
      {children}
    </button>
  )
}

export function SheetContent({ side = "right", className, children }: SheetContentProps) {
  const { open, setOpen } = React.useContext(SheetContext)

  if (!open) return null

  const sideStyles = {
    left: "left-0 top-0 h-full w-3/4 max-w-sm",
    right: "right-0 top-0 h-full w-3/4 max-w-sm",
    top: "top-0 left-0 w-full h-1/2 max-h-96",
    bottom: "bottom-0 left-0 w-full h-1/2 max-h-96",
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => setOpen(false)}
      />
      {/* Content */}
      <div
        className={cn(
          "fixed z-50 bg-background shadow-lg transition-transform",
          sideStyles[side],
          className
        )}
      >
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </>
  )
}

export function SheetHeader({ className, children }: SheetHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left p-4", className)}>
      {children}
    </div>
  )
}

export function SheetTitle({ className, children }: SheetTitleProps) {
  return (
    <h3 className={cn("text-lg font-semibold", className)}>
      {children}
    </h3>
  )
}

export function SheetDescription({ className, children }: SheetDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  )
}
