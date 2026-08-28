import { useEffect } from 'react'

const MOUSE_TYPES: Array<'mousemove' | 'mousedown' | 'mouseup'> = [
  'mousemove',
  'mousedown',
  'mouseup',
]

function isInsideCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect()
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}

function forwardMouseEvent(canvas: HTMLCanvasElement, event: MouseEvent) {
  canvas.dispatchEvent(
    new MouseEvent(event.type, {
      clientX: event.clientX,
      clientY: event.clientY,
      bubbles: true,
      cancelable: true,
      buttons: event.buttons,
      button: event.button,
      view: window,
    }),
  )
}

/**
 * Forwards mouse events from anywhere on the viewport to the Rive canvas.
 * Rive's runtime listens on mousemove/mousedown/mouseup (not pointer events).
 */
export function useGlobalRivePointer(canvas: HTMLCanvasElement | null) {
  useEffect(() => {
    if (!canvas) return

    const onMouse = (event: MouseEvent) => {
      if (isInsideCanvas(canvas, event.clientX, event.clientY)) return
      forwardMouseEvent(canvas, event)
    }

    for (const type of MOUSE_TYPES) {
      window.addEventListener(type, onMouse, { passive: true })
    }

    return () => {
      for (const type of MOUSE_TYPES) {
        window.removeEventListener(type, onMouse)
      }
    }
  }, [canvas])
}
