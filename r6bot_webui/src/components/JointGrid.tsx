import { Cpu } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { JointCard } from '@/components/JointCard'
import type { JointData } from '@/types'

interface JointGridProps {
  joints: JointData[]
}

const JOINT_LABELS = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6']
const PLACEHOLDER: JointData[] = JOINT_LABELS.map((_, i) => ({
  name: `joint_${i + 1}`,
  position: 0,
  velocity: 0,
  effort: 0,
}))

export function JointGrid({ joints }: JointGridProps) {
  const displayJoints = joints.length > 0 ? joints : PLACEHOLDER
  const hasData = joints.length > 0

  return (
    <Card className="flex-1">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5" />
          Joint States
          {!hasData && (
            <span className="text-[10px] text-yellow-400 font-normal ml-auto">
              Waiting for /joint_states…
            </span>
          )}
          {hasData && (
            <span className="text-[10px] text-green-400 font-normal ml-auto">
              Live
            </span>
          )}
        </CardTitle>

        <div className="flex items-center justify-between px-0 pt-2 pb-1 text-[10px] text-muted-foreground">
          <span className="ml-8">Joint</span>
          <div className="flex gap-3">
            <span className="w-20 text-right">Position (deg)</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {displayJoints.map((joint, i) => (
          <JointCard
            key={joint.name}
            joint={joint}
            index={i}
          />
        ))}
      </CardContent>
    </Card>
  )
}
