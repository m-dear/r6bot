import { useState, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { clamp, cn, degToRad, radToDeg } from '@/lib/utils'
import type { JointData } from '@/types'

interface JointTableProps {
  joints: JointData[]
  connected: boolean
  ros2DriverConnected: boolean
  sendCommand: (positionsRad: number[], speedPercent?: number) => void
}

const PLACEHOLDER: JointData[] = Array.from({ length: 6 }, (_, i) => ({
  name: `joint_${i + 1}`,
  position: 0,
  velocity: 0,
}))

const DEG_MIN = -180
const DEG_MAX = 180
const DEFAULT_INCREMENT_DEG = 1
const DEFAULT_SPEED_PERCENT = 50

const HOLD_DELAY_MS = 350
const HOLD_INTERVAL_MS = 120

export function JointTable({ joints, connected, ros2DriverConnected, sendCommand }: JointTableProps) {
  const rows = joints.length === 6 ? joints : PLACEHOLDER
  const hasData = joints.length === 6
  const jogDisabled = !connected || !hasData || ros2DriverConnected
  const [incrementDeg, setIncrementDeg] = useState(DEFAULT_INCREMENT_DEG)
  const [speedPercent, setSpeedPercent] = useState(DEFAULT_SPEED_PERCENT)
  const [pressedKey, setPressedKey] = useState<string | null>(null)

  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  // Always-fresh ref so the interval sees latest joints
  const jogRef = useRef<((index: number, dir: -1 | 1) => void) | null>(null)

  function handleJog(index: number, direction: -1 | 1) {
    if (jogDisabled) return

    const currentDeg = radToDeg(joints[index].position)
    const nextDeg = clamp(currentDeg + direction * incrementDeg, DEG_MIN, DEG_MAX)
    const next = joints.map((joint, i) => (i === index ? degToRad(nextDeg) : joint.position))

    sendCommand(next, speedPercent)
  }

  jogRef.current = handleJog

  function startJog(index: number, direction: -1 | 1) {
    if (jogDisabled) return
    const key = `${index}${direction > 0 ? '+' : '-'}`
    setPressedKey(key)
    jogRef.current?.(index, direction)

    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(() => {
        jogRef.current?.(index, direction)
      }, HOLD_INTERVAL_MS)
    }, HOLD_DELAY_MS)
  }

  function stopJog() {
    setPressedKey(null)
    if (holdTimeout.current) { clearTimeout(holdTimeout.current); holdTimeout.current = null }
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/60">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Joint Configuration
        </h2>
        {!hasData && (
          <span className="text-[10px] text-amber-600 font-medium">Waiting…</span>
        )}
{hasData && ros2DriverConnected && (
          <span className="text-[10px] text-amber-600 font-semibold">Busy</span>
        )}
      </div>

      {/* Jog settings */}
      <div className="space-y-3 border-b border-border px-4 py-3">
        {ros2DriverConnected && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Busy: ROS2 driver connected. Web jog is disabled.
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Robot Speed</span>
            <span className={cn(
              'text-sm font-mono font-semibold tabnum',
              ros2DriverConnected ? 'text-muted-foreground' : 'text-foreground'
            )}>
              {speedPercent}%
            </span>
          </div>
          <Slider
            min={1}
            max={100}
            step={1}
            value={[speedPercent]}
            onValueChange={([v]) => setSpeedPercent(Math.round(v))}
            disabled={ros2DriverConnected}
            className="flex-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">Step</span>
          <input
            type="number"
            value={incrementDeg}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) setIncrementDeg(clamp(v, 0.1, 45))
            }}
            step="1"
            min={0.1}
            max={45}
            disabled={ros2DriverConnected}
            className="h-8 w-20 rounded border border-input bg-background px-2 text-sm font-mono text-right focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">deg</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[56px_96px_1fr] gap-3 px-4 py-1.5 border-b border-border">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Joint</span>
        <span className="text-[10px] font-semibold uppercase text-muted-foreground text-right">Current</span>
        <span className="text-[10px] font-semibold uppercase text-muted-foreground text-center">Jog</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.map((joint, i) => {
          const deg = radToDeg(joint.position)
          const isNearLimit = Math.abs(joint.position) > 2.8

          return (
            <div key={joint.name}>
              <div
                className={cn(
                  'grid grid-cols-[56px_96px_1fr] items-center gap-3 px-4 py-2.5 border-b border-border/60 transition-colors',
                  'hover:bg-muted/50',
                  isNearLimit && 'bg-orange-50 hover:bg-orange-50'
                )}
              >
                {/* Joint label */}
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'text-sm font-bold w-8',
                    isNearLimit ? 'text-orange-600' : 'text-foreground'
                  )}>
                    J{i + 1}
                  </span>
                </div>

                {/* Position */}
                <span className={cn(
                  'text-sm font-mono tabnum text-right font-semibold',
                  isNearLimit ? 'text-orange-600' : 'text-foreground'
                )}>
                  {(deg >= 0 ? '+' : '')}{deg.toFixed(2)}°
                </span>

                {/* Jog controls */}
                <div className="grid grid-cols-2 gap-1.5">
                  {([[-1, 'outline', Minus], [1, 'default', Plus]] as const).map(([dir, variant, Icon]) => {
                    const key = `${i}${dir > 0 ? '+' : '-'}`
                    const isPressed = pressedKey === key
                    return (
                      <Button
                        key={dir}
                        variant={variant}
                        size="sm"
                        disabled={jogDisabled}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startJog(i, dir) }}
                        onPointerUp={stopJog}
                        onPointerLeave={stopJog}
                        className={cn(
                          'h-8 select-none px-2 transition-all duration-75',
                          isPressed && 'scale-95 ring-2 ring-ring ring-offset-1',
                          isPressed && variant === 'outline' && 'bg-accent',
                          isPressed && variant === 'default' && 'brightness-75',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {incrementDeg}°
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
