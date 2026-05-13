import { useCallback, useEffect, useRef, useState } from 'react'
import type { BridgeJointStateMsg, JointData, RobotWebSocketState } from '@/types'

const MOVING_THRESHOLD = 0.005   // rad/s — below this counts as idle
const STALE_TIMEOUT_MS = 1500    // mark inactive if no message for this long

const EMPTY: Omit<RobotWebSocketState, 'sendCommand'> = {
  connected: false,
  joints: [],
  messageCount: 0,
  hz: 0,
  lastUpdate: null,
  isMoving: false,
  ros2DriverConnected: false,
}

export function useRobotWebSocket(url: string): RobotWebSocketState {
  const wsRef     = useRef<WebSocket | null>(null)
  const countRef  = useRef(0)
  const hzBufRef  = useRef<number[]>([])
  const [state, setState] = useState<Omit<RobotWebSocketState, 'sendCommand'>>(EMPTY)

  const sendCommand = useCallback((positionsRad: number[], speedPercent?: number) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'command',
        positions: positionsRad,
        speed: speedPercent,
      }))
    }
  }, [])

  useEffect(() => {
    if (!url) return

    let ws: WebSocket
    let alive = true

    function connect() {
      ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!alive) return
        setState((s) => ({ ...s, connected: true }))
      }

      ws.onclose = () => {
        if (!alive) return
        wsRef.current = null
        setState(EMPTY)
        // Reconnect after 2 s
        setTimeout(() => { if (alive) connect() }, 2000)
      }

      ws.onerror = () => {
        // onclose fires right after — no extra handling needed
      }

      ws.onmessage = (ev) => {
        if (!alive) return
        try {
          const msg = JSON.parse(ev.data as string) as BridgeJointStateMsg
          if (msg.type !== 'joint_states') return

          const now = Date.now()
          countRef.current += 1
          hzBufRef.current.push(now)
          const cutoff = now - 2000
          hzBufRef.current = hzBufRef.current.filter((t) => t > cutoff)
          const hz = Math.round(hzBufRef.current.length / 2)

          const joints: JointData[] = msg.names.map((name, i) => ({
            name,
            position: msg.positions[i] ?? 0,
            velocity: msg.velocities[i] ?? 0,
          }))

          const isMoving = joints.some((j) => Math.abs(j.velocity) > MOVING_THRESHOLD)

          setState({
            connected: true,
            joints,
            messageCount: countRef.current,
            hz,
            lastUpdate: now,
            isMoving,
            ros2DriverConnected: msg.ros2_driver ?? false,
          })
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()

    // Watchdog: mark inactive if messages stop arriving
    const watchdog = setInterval(() => {
      setState((s) => {
        if (s.lastUpdate && Date.now() - s.lastUpdate > STALE_TIMEOUT_MS) {
          return { ...s, isMoving: false }
        }
        return s
      })
    }, 500)

    return () => {
      alive = false
      clearInterval(watchdog)
      ws?.close()
      wsRef.current = null
    }
  }, [url])

  return { ...state, sendCommand }
}
