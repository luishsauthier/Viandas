import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'

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
 * Cursor tracking is driven by Rive Listeners inside the .riv file —
 * pointer events on the canvas are enough; no manual inputs required.
 */
export function InteractiveRobot({ className = '', size = 180 }: InteractiveRobotProps) {
  const { RiveComponent } = useRive({
    src: ROBOT_SRC,
    artboard: ARTBOARD,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  })

  return (
    <div
      className={`mx-auto overflow-hidden rounded-2xl bg-[#2a2e32] touch-none select-none ${className}`}
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
