import { Component, Suspense, lazy, useState, useMemo, type ReactNode } from 'react'
import { useRobotWebSocket } from '@/hooks/useRobotWebSocket'
import { TopBar }       from '@/components/TopBar'
import { JointTable }   from '@/components/JointTable'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge }        from '@/components/ui/badge'
import { Circle }       from 'lucide-react'

type Tab = 'move' | 'status'

function getDefaultWebSocketUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:8765'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname || 'localhost'
  return `${protocol}//${host}:8765`
}

const RobotView3D = lazy(() =>
  import('@/components/RobotView3D').then((mod) => ({ default: mod.RobotView3D }))
)

class RobotViewBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: '' }

  static getDerivedStateFromError(error: unknown) {
    return {
      failed: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown) {
    console.error('Robot DAE/URDF view failed:', error)
  }

  render() {
    if (this.state.failed) {
      const isWebGL = /webgl|gl context|gpu/i.test(this.state.message)
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background p-4">
          <div className="max-w-lg rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-semibold">
              {isWebGL
                ? '3D view unavailable — WebGL context could not be created.'
                : 'R6Bot DAE/URDF model failed to load.'}
            </p>
            <p className="mt-2 font-mono text-xs">{this.state.message}</p>

            {isWebGL ? (
              <>
                <p className="mt-3 text-xs text-muted-foreground">
                  This is a GPU/display problem, not a mesh problem. The mesh files are fine —
                  the browser could not get a hardware WebGL context on the display it is running on.
                </p>
                <p className="mt-3 text-xs font-semibold text-foreground">Most likely cause</p>
                <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                  <li>
                    The server is being viewed inside a <strong>headless or virtual display</strong>
                    (Xvfb, x11vnc, xrdp, SSH X-forwarding). No GPU is bound to that display, so WebGL
                    cannot run even if the machine has a GPU.
                  </li>
                  <li>Or browser hardware acceleration is off / GPU drivers missing / blocklisted.</li>
                </ul>
                <p className="mt-3 text-xs font-semibold text-foreground">How to fix</p>
                <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                  <li>
                    <strong>Open this URL from a machine with a real display</strong> (laptop,
                    desktop with a monitor). Any browser on the LAN can connect — the dashboard is
                    just HTTP.
                  </li>
                  <li>
                    Or launch Chrome with software WebGL (slow):
                    <code className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px]">
                      google-chrome --enable-unsafe-swiftshader --ignore-gpu-blocklist
                    </code>
                  </li>
                </ul>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Check that the DAE files exist under
                <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[10px]">
                  r6bot_webui/public/meshes/visual/
                </code>
                and that the dev server has restarted since the last mesh-path change.
              </p>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function Dashboard() {
  const [url, setUrl]                   = useState(getDefaultWebSocketUrl)
  const [activeUrl, setActiveUrl]       = useState(getDefaultWebSocketUrl)
  const [tab, setTab]                   = useState<Tab>('move')

  const {
    connected, joints, messageCount, hz,
    lastUpdate, isMoving, ros2DriverConnected, sendCommand,
  } = useRobotWebSocket(activeUrl)

  const robotActive = useMemo(
    () => connected && lastUpdate !== null && Date.now() - (lastUpdate ?? 0) < 1500,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connected, lastUpdate, isMoving]
  )

  function handleUrlChange(u: string) {
    setUrl(u)
    if (u.startsWith('ws://') || u.startsWith('wss://')) setActiveUrl(u)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <TopBar
        connected={connected}
        isMoving={isMoving}
        robotActive={robotActive}
        url={url}
        onUrlChange={handleUrlChange}
        tab={tab}
        onTabChange={setTab}
      />

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── MOVE tab ────────────────────────────────────────────────────── */}
        {tab === 'move' && (
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
            {/* Left panel: joint table with inline jog controls */}
            <div className="flex h-80 shrink-0 flex-col overflow-hidden border-b border-border bg-card md:h-auto md:w-[420px] md:border-b-0 md:border-r">
              <div className="flex-1 overflow-hidden flex flex-col">
                <JointTable
                  joints={joints}
                  connected={connected}
                  ros2DriverConnected={ros2DriverConnected}
                  sendCommand={sendCommand}
                />
              </div>
            </div>

            {/* Right panel: 3D robot visualization */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <RobotViewBoundary>
                <Suspense
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center bg-background text-sm text-muted-foreground">
                      Loading R6Bot DAE model from r6bot_description...
                    </div>
                  }
                >
                  <RobotView3D joints={joints} />
                </Suspense>
              </RobotViewBoundary>
            </div>
          </div>
        )}

        {/* ── STATUS tab ──────────────────────────────────────────────────── */}
        {tab === 'status' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">

              {/* Connection */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 divide-y divide-border">
                  {[
                    { label: 'Bridge Server', sub: activeUrl, ok: connected },
                    { label: 'Robot Sim',     sub: 'joint states streaming', ok: robotActive },
                    { label: 'ROS2 Driver',   sub: 'UDP port 30000', ok: ros2DriverConnected },
                  ].map(({ label, sub, ok }) => (
                    <div key={label} className="flex items-center justify-between pt-2 first:pt-0">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{sub}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-green-600' : 'text-slate-400'}`}>
                        <Circle className={`h-2.5 w-2.5 fill-current ${ok ? 'animate-pulse' : ''}`} />
                        {ok ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Trajectory */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Trajectory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">State</span>
                    <Badge variant={isMoving ? 'warning' : 'success'}>
                      {isMoving ? 'Moving' : 'Idle'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Statistics */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: 'Update Rate',  val: messageCount > 0 ? `${hz} Hz` : '—' },
                    { label: 'Messages',     val: messageCount.toLocaleString() },
                    { label: 'Last update',  val: lastUpdate ? `${((Date.now() - lastUpdate) / 1000).toFixed(1)}s ago` : '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-mono font-semibold">{val}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
