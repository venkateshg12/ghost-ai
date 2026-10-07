"use client"

import * as React from "react"

interface UseKeyboardShortcutsOptions {
  onZoomIn: () => void
  onZoomOut: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export function useKeyboardShortcuts({
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = true,
}: UseKeyboardShortcutsOptions) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase()
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable ||
          activeEl.classList.contains("nodrag") ||
          activeEl.classList.contains("nopan")
        ) {
          return
        }
      }

      const isCmdOrCtrl = event.metaKey || event.ctrlKey
      const key = event.key

      // Undo: Cmd/Ctrl + Z (without Shift)
      if (isCmdOrCtrl && key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault()
        if (canUndo) onUndo()
        return
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        isCmdOrCtrl &&
        ((key.toLowerCase() === "z" && event.shiftKey) || key.toLowerCase() === "y")
      ) {
        event.preventDefault()
        if (canRedo) onRedo()
        return
      }

      // Zoom In: + or =
      if (!isCmdOrCtrl && (key === "+" || key === "=")) {
        event.preventDefault()
        onZoomIn()
        return
      }

      // Zoom Out: -
      if (!isCmdOrCtrl && key === "-") {
        event.preventDefault()
        onZoomOut()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onZoomIn, onZoomOut, onUndo, onRedo, canUndo, canRedo])
}
