import { useState } from 'react'
import { RotateCcw, Play, Square } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn, degToRad, radToDeg } from '@/lib/utils'
import type { JointData } from '@/types'

interface JointControlPanelProps {
  joints: JointData[]
  connected: boolean
  sendCommand: (positionsRad: number[]) => void
}

const JOINT_LABELS = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6']
const DEG_MIN = -180
const DEG_MAX = 180

export function JointControlPanel({ joints, connected, sendCommand }: JointControlPanelProps) {
  const [cmdDeg, setCmdDeg] = useState<number[]>([0, 0, 0, 0, 0, 0])
  const [flash, setFlash] = useState(false)

  function syncFromRobot() {
    if (joints.length === 6) {
      setCmdDeg(joints.map((j) => parseFloat(radToDeg(j.position).toFixed(2))))
    }
  }

  function handleSend() {
    sendCommand(cmdDeg.map(degToRad))
    setFlash(true)
    setTimeout(() => setFlash(false), 400)
  }

  function handleStop() {
    // Send current actual positions → robot holds still
    if (joints.length === 6) {
      sendCommand(joints.map((j) => j.position))
    }
  }

  function updateJoint(index: number, deg: number) {
    setCmdDeg((prev) => {
      const next = [...prev]
      next[index] = deg
      return next
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Joint Control — Manual Jog</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={syncFromRobot}
              disabled={!connected || joints.length === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Sync
            </Button>
            <Button
              variant={flash ? 'secondary' : 'success'}
              size="sm"
              onClick={handleSend}
              disabled={!connected}
            >
              <Play className="h-3.5 w-3.5" />
              {flash ? 'Sent!' : 'Send'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              disabled={!connected}
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {JOINT_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-4">
            <span className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold bg-primary/20 text-primary'
            )}>
              {label}
            </span>

            <div className="flex flex-1 items-center gap-3">
              <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">{DEG_MIN}°</span>
              <Slider
                min={DEG_MIN}
                max={DEG_MAX}
                step={0.1}
                value={[cmdDeg[i] ?? 0]}
                onValueChange={([v]) => updateJoint(i, v)}
                disabled={!connected}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground w-10 shrink-0">+{DEG_MAX}°</span>
            </div>

            <input
              type="number"
              value={cmdDeg[i]?.toFixed(1) ?? '0.0'}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) updateJoint(i, Math.max(DEG_MIN, Math.min(DEG_MAX, v)))
              }}
              className="h-7 w-20 shrink-0 rounded border border-input bg-background px-2 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-ring"
              step="0.1"
              min={DEG_MIN}
              max={DEG_MAX}
            />
          </div>
        ))}

        {!connected && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            Start the bridge server to enable joint control
          </p>
        )}
      </CardContent>
    </Card>
  )
}
