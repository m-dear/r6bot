import { Circle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface ConnectionPanelProps {
  bridgeConnected: boolean
  robotActive: boolean
  ros2DriverConnected: boolean
}

interface StatusRowProps {
  label: string
  sublabel: string
  active: boolean
  activeText: string
  inactiveText: string
  pulse?: boolean
}

function StatusRow({ label, sublabel, active, activeText, inactiveText, pulse }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? 'text-green-400' : 'text-slate-500'}`}>
        <Circle className={`h-2.5 w-2.5 fill-current ${active && pulse ? 'animate-pulse' : ''}`} />
        {active ? activeText : inactiveText}
      </div>
    </div>
  )
}

export function ConnectionPanel({ bridgeConnected, robotActive, ros2DriverConnected }: ConnectionPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Connection Status</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <StatusRow
          label="Bridge Server"
          sublabel="ws://localhost:8765"
          active={bridgeConnected}
          activeText="Connected"
          inactiveText="Disconnected"
        />
        <StatusRow
          label="Robot Sim"
          sublabel="joint states streaming"
          active={robotActive}
          activeText="Active"
          inactiveText="No data"
          pulse
        />
        <StatusRow
          label="ROS2 Driver"
          sublabel="UDP port 30000 (optional)"
          active={ros2DriverConnected}
          activeText="Connected"
          inactiveText="Not connected"
        />
      </CardContent>
    </Card>
  )
}
