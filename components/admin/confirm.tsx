'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button, Input } from './ui'

export interface ConfirmOptions {
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  typeToConfirm?: string
}

export type Confirm = (options: ConfirmOptions) => Promise<boolean>

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

const ConfirmContext = createContext<Confirm | null>(null)

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider')
  return confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [typed, setTyped] = useState('')

  const confirm = useCallback<Confirm>((options) => new Promise<boolean>((resolve) => {
    setTyped('')
    setPending((current) => {
      current?.resolve(false)
      return { options, resolve }
    })
  }), [])

  const settle = (value: boolean) => {
    pending?.resolve(value)
    setPending(null)
  }

  const options = pending?.options
  const word = options?.typeToConfirm
  const blocked = Boolean(word) && typed !== word

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!blocked) settle(true)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) settle(false) }}>
        {options && (
          <DialogContent showCloseButton={false} className="gap-4 p-5 sm:max-w-md">
            <form onSubmit={onSubmit} className="grid gap-4">
              <DialogHeader className="gap-1.5">
                <DialogTitle className="text-[15px] leading-normal">{options.title}</DialogTitle>
                {options.description
                  ? <DialogDescription className="whitespace-pre-line text-[13px]">{options.description}</DialogDescription>
                  : <DialogDescription className="sr-only">{options.title}</DialogDescription>}
              </DialogHeader>
              {word && (
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  aria-label={word}
                  placeholder={word}
                  autoComplete="off"
                />
              )}
              <DialogFooter>
                <Button type="button" onClick={() => settle(false)}>Болих</Button>
                <Button type="submit" variant={options.destructive ? 'danger' : 'primary'} disabled={blocked}>
                  {options.confirmLabel ?? 'Тийм'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  )
}
