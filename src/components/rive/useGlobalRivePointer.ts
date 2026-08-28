import { useEffect } from 'react'

const POINTER_TYPES: Array<'pointermove' | 'pointerdown' | 'pointerup'> = [
  'pointermove',
  'pointerdown',
  'pointerup',
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

function forwardPointerEvent(canvas: HTMLCanvasElement, event: PointerEvent) {
  canvas.dispatchEvent(
    new PointerEvent(event.type, {
      clientX: event.clientX,
      clientY: event.clientY,
      bubbles: true,
      cancelable: true,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      pressure: event.pressure,
      buttons: event.buttons,
      button: event.button,
    }),
  )
}

/**
 * Forwards pointer events from anywhere on the viewport to the Rive canvas.
 * Built-in listeners only attach to the canvas; this extends tracking to the full screen.
 */
export function useGlobalRivePointer(canvas: HTMLCanvasElement | null) {
  useEffect(() => {
    if (!canvas) return

    const onPointer = (event: PointerEvent) => {
      if (isInsideCanvas(canvas, event.clientX, event.clientY)) return
      forwardPointerEvent(canvas, event)
    }

    for (const type of POINTER_TYPES) {
      window.addEventListener(type, onPointer)
    }

    return () => {
      for (const type of POINTER_TYPES) {
        window.removeEventListener(type, onPointer)
      }
    }
  }, [canvas])
}
