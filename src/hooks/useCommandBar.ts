'use client'

import { useEffect, useCallback } from 'react'
import { useCommandStore } from '@/stores/command.store'

/**
 * Registers the global Cmd+K / Ctrl+K keyboard shortcut.
 * Mount once in DashboardShell (or any persistent layout component).
 */
export function useCommandBar() {
  const isOpen = useCommandStore((s) => s.isOpen)
  const setOpen = useCommandStore((s) => s.setOpen)

  const open = useCallback(() => setOpen(true), [setOpen])
  const close = useCallback(() => setOpen(false), [setOpen])
  const toggle = useCallback(() => setOpen(!isOpen), [isOpen, setOpen])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggle()
        return
      }
      if (e.key === 'Escape' && isOpen) {
        close()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle, close, isOpen])

  return { isOpen, open, close, toggle }
}
