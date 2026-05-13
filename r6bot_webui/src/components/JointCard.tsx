import { cn, radToDeg } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import type { JointData } from '@/types'

interface JointCardProps {
  joint: JointData
  index: number
}

const MAX_POS = Math.PI

function positionToPercent(rad: number): number {
  return ((rad + MAX_POS) / (2 * MAX_POS)) * 100
}

function getBarColor(position: number): string {
  if (Math.abs(position) > 2.8) return 'bg-orange-500'
  return 'bg-green-500'
}

export function JointCard({ joint, index }: JointCardProps) {
  const deg = radToDeg(joint.position)
  const pct = positionToPercent(joint.position)
  const barColor = getBarColor(joint.position)
  const isNearLimit = Math.abs(joint.position) > 2.8

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold',
            isNearLimit ? 'bg-orange-500/20 text-orange-400' :
            'bg-primary/20 text-primary'
          )}>
            J{index + 1}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={cn(
            'text-sm font-mono font-semibold tabular-nums w-20 text-right joint-value',
            isNearLimit ? 'text-orange-400' : 'text-foreground'
          )}>
            {deg >= 0 ? '+' : ''}{deg.toFixed(2)}°
          </span>
        </div>
      </div>

      <Progress
        value={Math.max(0, Math.min(100, pct))}
        className="h-1.5"
        indicatorClassName={cn('transition-all duration-100', barColor)}
      />
    </div>
  )
}
