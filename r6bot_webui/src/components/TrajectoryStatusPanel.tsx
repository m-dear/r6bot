import { Activity, CheckCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TrajectoryStatusPanelProps {
  isMoving: boolean
  hasState: boolean
}

export function TrajectoryStatusPanel({ isMoving, hasState }: TrajectoryStatusPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Trajectory Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">State</span>
          {!hasState ? (
            <Badge variant="idle">Unknown</Badge>
          ) : isMoving ? (
            <Badge variant="warning" className="gap-1.5">
              <Activity className="h-3 w-3" />
              Moving
            </Badge>
          ) : (
            <Badge variant="success" className="gap-1.5">
              <CheckCircle className="h-3 w-3" />
              Idle
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">In Motion</span>
          <span className={`text-sm font-medium ${isMoving ? 'text-yellow-400' : 'text-slate-400'}`}>
            {hasState ? (isMoving ? 'Yes' : 'No') : '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
