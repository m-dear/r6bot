import { Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'move' | 'status'

interface TopBarProps {
  connected: boolean
  isMoving: boolean
  robotActive: boolean
  url: string
  onUrlChange: (u: string) => void
  tab: Tab
  onTabChange: (t: Tab) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'move',   label: 'Move'   },
  { id: 'status', label: 'Status' },
]

export function TopBar({ connected, isMoving, robotActive, url, onUrlChange, tab, onTabChange }: TopBarProps) {
  const stateLabel  = !connected ? 'Disconnected' : isMoving ? 'Moving' : robotActive ? 'Active' : 'Stopped'
  const stateColor  = !connected ? 'bg-slate-400' : isMoving ? 'bg-amber-500' : robotActive ? 'bg-green-500' : 'bg-slate-400'

  return (
    <header className="flex h-12 items-center gap-0 border-b border-border bg-card shadow-sm select-none shrink-0">
      {/* Robot identity */}
      <div className="flex items-center gap-3 px-4 border-r border-border h-full">
        {/* UR-style logo square */}
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-[10px] font-black text-white tracking-tight">
          R6
        </div>
        <div className="leading-none">
          <p className="text-sm font-bold tracking-wide">R6BOT</p>
          <p className="text-[10px] text-muted-foreground">6-DOF Arm</p>
        </div>
      </div>

      {/* Robot status badge */}
      <div className="flex items-center gap-2 px-4 border-r border-border h-full">
        <span className={cn('h-2.5 w-2.5 rounded-full', stateColor, robotActive && !isMoving && 'animate-pulse')} />
        <span className="text-sm font-medium">{stateLabel}</span>
      </div>

      {/* WS URL input */}
      <div className="flex items-center gap-2 px-3 h-full">
        {connected
          ? <Wifi className="h-3.5 w-3.5 text-green-600 shrink-0" />
          : <WifiOff className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
        <input
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="h-7 w-44 rounded border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="ws://robot-host:8765"
        />
      </div>

      <div className="flex-1" />

      {/* Navigation tabs (right-aligned like UR) */}
      <nav className="flex h-full items-stretch border-l border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={cn(
              'flex h-full items-center px-6 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary text-primary bg-accent/50'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
