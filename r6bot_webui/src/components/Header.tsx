import { Bot, Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  connected: boolean
  robotActive: boolean
  url: string
  onUrlChange: (url: string) => void
}

export function Header({ connected, robotActive, url, onUrlChange }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-base font-bold tracking-tight">R6Bot Dashboard</h1>
            <p className="text-[10px] text-muted-foreground leading-none">6-DOF Robotic Arm</p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">bridge:</span>
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className="h-7 w-52 rounded border border-input bg-background px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="ws://localhost:8765"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={connected ? 'success' : 'error'}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>

          <Badge variant={robotActive ? 'success' : 'idle'}>
            <span className={`h-2 w-2 rounded-full ${robotActive ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
            Robot {robotActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>
    </header>
  )
}
