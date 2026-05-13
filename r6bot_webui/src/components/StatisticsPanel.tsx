import { BarChart2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface StatisticsPanelProps {
  hz: number
  messageCount: number
  lastUpdate: number | null
}

export function StatisticsPanel({ hz, messageCount, lastUpdate }: StatisticsPanelProps) {
  const staleSec = lastUpdate ? ((Date.now() - lastUpdate) / 1000).toFixed(1) : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="h-3.5 w-3.5" />
          Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Update Rate</span>
          <span className="text-sm font-mono font-medium">
            {messageCount > 0 ? `${hz} Hz` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Messages</span>
          <span className="text-sm font-mono font-medium">
            {messageCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last Update</span>
          <span className={`text-sm font-mono ${staleSec && parseFloat(staleSec) > 1 ? 'text-yellow-400' : 'text-foreground'}`}>
            {staleSec ? `${staleSec}s ago` : '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
