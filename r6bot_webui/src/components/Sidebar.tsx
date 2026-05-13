import { Activity, Settings, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'move' | 'status'

interface SidebarProps {
  tab: Tab
  onTabChange: (t: Tab) => void
  connected: boolean
}

const ITEMS = [
  { id: 'move'   as Tab, icon: Activity, label: 'Move'   },
  { id: 'status' as Tab, icon: Wifi,     label: 'Status' },
] as const

export function Sidebar({ tab, onTabChange, connected }: SidebarProps) {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-border bg-card py-2 gap-1">
      {ITEMS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          title={label}
          className={cn(
            'flex flex-col items-center justify-center w-10 h-10 rounded-lg gap-0.5 text-[9px] font-medium transition-colors',
            tab === id
              ? 'bg-primary text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}

      <div className="flex-1" />

      {/* Connection dot at bottom */}
      <div
        title={connected ? 'Bridge connected' : 'Bridge disconnected'}
        className={cn(
          'h-2.5 w-2.5 rounded-full mb-1 transition-colors',
          connected ? 'bg-green-500' : 'bg-red-400'
        )}
      />

      <button
        title="Settings"
        className="flex flex-col items-center justify-center w-10 h-10 rounded-lg gap-0.5 text-[9px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Settings className="h-4 w-4" />
        Config
      </button>
    </aside>
  )
}
