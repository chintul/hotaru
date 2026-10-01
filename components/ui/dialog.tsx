"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/25 duration-(--dur) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  placement = "center",
  overlayProps,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  closeLabel?: string
  placement?: "center" | "bottom-on-phone" | "top-on-phone"
  overlayProps?: React.ComponentProps<typeof DialogPrimitive.Overlay>
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay {...overlayProps} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-placement={placement}
        className={cn(
          "fixed z-50 grid w-full gap-4 border bg-background p-6 text-foreground shadow-(--t-lift) duration-(--dur) ease-(--ease) outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          placement === "center" &&
            "top-[50%] left-[50%] max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-bottom-[14px] sm:max-w-lg",
          placement === "bottom-on-phone" &&
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[26px] pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-h-[86dvh] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[26px] sm:pb-6 sm:data-[state=closed]:slide-out-to-bottom-[14px] sm:data-[state=closed]:zoom-out-[0.97] sm:data-[state=open]:slide-in-from-bottom-[14px] sm:data-[state=open]:zoom-in-[0.97]",
          placement === "top-on-phone" &&
            "inset-x-0 top-0 max-h-[85dvh] rounded-b-[22px] border-0 border-b pt-[env(safe-area-inset-top)] data-[state=closed]:duration-150 data-[state=closed]:slide-out-to-top-6 data-[state=open]:slide-in-from-top-6 lg:inset-x-auto lg:top-[12vh] lg:left-[50%] lg:max-h-[72vh] lg:max-w-[640px] lg:translate-x-[-50%] lg:rounded-[22px] lg:border lg:pt-0 lg:data-[state=closed]:slide-out-to-top-2 lg:data-[state=closed]:zoom-out-[0.98] lg:data-[state=open]:slide-in-from-top-3 lg:data-[state=open]:zoom-in-[0.97]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-2 right-2 grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors duration-(--dur-fast) outline-none hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none sm:size-10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5"
          >
            <XIcon />
            <span className="sr-only">{closeLabel}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  closeLabel = "Close",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
  closeLabel?: string
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{closeLabel}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
