import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'
import { useGlobalRivePointer } from '@/components/rive/useGlobalRivePointer'

const ROBOT_SRC = `${import.meta.env.BASE_URL}rive/cute-interactive-robot.riv`
const ARTBOARD = 'Main'
const STATE_MACHINE = 'State Machine 1'

type InteractiveRobotProps = {
  className?: string
  /** Canvas size in px (square). */
  size?: number
}

/**
 * Cute Interactive Robot by telegivcom (CC BY 4.0).
 * https://rive.app/marketplace/5308-11093-cute-interactive-robot/
 *
 * Cursor tracking uses Rive Listeners in the .riv file. Pointer events on the
 * canvas drive the animation; useGlobalRivePointer extends that to the full viewport.
 */
export function InteractiveRobot({ className = '', size = 180 }: InteractiveRobotProps) {
  const { RiveComponent, canvas } = useRive({
    src: ROBOT_SRC,
    artboard: ARTBOARD,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  })

  useGlobalRivePointer(canvas)

  return (
    <div
      className={`mx-auto overflow-hidden rounded-2xl bg-[#2a2e32] select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <RiveComponent className="h-full w-full" />
    </div>
  )
}

export function RobotAttribution({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-ink-muted ${className}`}>
      Robot by{' '}
      <a
        href="https://rive.app/marketplace/5308-11093-cute-interactive-robot/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-border underline-offset-2 hover:text-ink"
      >
        telegivcom
      </a>{' '}
      · CC BY
    </p>
  )
}

/** Robot + credit for auth / landing surfaces. */
export function AuthMascot({ size = 160 }: { size?: number }) {
  return (
    <div className="-mt-2 mb-4">
      <InteractiveRobot size={size} />
      <RobotAttribution className="mt-1" />
    </div>
  )
}
