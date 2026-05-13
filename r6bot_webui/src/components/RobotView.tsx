import { useMemo } from 'react'
import type { JointData } from '@/types'

interface RobotViewProps {
  joints: JointData[]
}

// SVG canvas size
const W = 440
const H = 420

// Base attachment point (bottom-centre of canvas)
const BASE_X = W / 2
const BASE_Y = H - 48

// Link pixel lengths (proportional to a realistic 6-DOF arm)
const LINK_LEN = [52, 88, 76, 46, 36, 24]

// Workspace radius for the grid circle
const GRID_R = Math.min(W, H) * 0.44

// Compute SVG points for all arm segments via planar FK.
// joint_1 only rotates the base horizontally — we show it as a base arc.
// joints 2–6 define the planar configuration.
function computePoints(joints: JointData[]): [number, number][] {
  const pts: [number, number][] = [[BASE_X, BASE_Y]]

  // Fixed vertical base post
  pts.push([BASE_X, BASE_Y - LINK_LEN[0]])

  let cumAngle = 0   // cumulative angle from vertical (SVG: up = -Y)
  let [cx, cy] = pts[1]

  for (let i = 1; i < 6; i++) {
    const pos = joints[i]?.position ?? 0
    cumAngle += pos
    const len = LINK_LEN[i]
    cx = cx + Math.sin(cumAngle) * len
    cy = cy - Math.cos(cumAngle) * len  // SVG Y inverted
    pts.push([cx, cy])
  }

  return pts
}

// Radial grid lines (every 30°)
const GRID_LINES = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180
  return {
    x2: BASE_X + Math.cos(a - Math.PI / 2) * GRID_R,
    y2: BASE_Y + Math.sin(a - Math.PI / 2) * GRID_R,
  }
})

const GRID_CIRCLES = [0.25, 0.5, 0.75, 1.0]

export function RobotView({ joints }: RobotViewProps) {
  const points = useMemo(
    () => computePoints(joints.length === 6 ? joints : Array(6).fill({ position: 0, velocity: 0, name: '' })),
    [joints]
  )

  const base1Angle = joints[0]?.position ?? 0   // base rotation for arc indicator
  const endEffector = points[points.length - 1]

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full bg-background select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        style={{ maxWidth: 520, maxHeight: 490 }}
      >
        {/* ── Workspace grid ──────────────────────────────────────────────── */}
        {/* Background fill */}
        <circle cx={BASE_X} cy={BASE_Y} r={GRID_R}
          fill="hsl(210 40% 97%)" stroke="hsl(214 18% 84%)" strokeWidth="1" />

        {/* Concentric rings */}
        {GRID_CIRCLES.map((f, i) => (
          <circle
            key={i} cx={BASE_X} cy={BASE_Y} r={GRID_R * f}
            fill="none"
            stroke={f === 1.0 ? 'hsl(214 18% 76%)' : 'hsl(214 18% 88%)'}
            strokeWidth={f === 1.0 ? 1.5 : 1}
            strokeDasharray={f === 1.0 ? undefined : '4 4'}
          />
        ))}

        {/* Radial lines */}
        {GRID_LINES.map((l, i) => (
          <line key={i} x1={BASE_X} y1={BASE_Y} x2={l.x2} y2={l.y2}
            stroke="hsl(214 18% 88%)" strokeWidth="1" />
        ))}

        {/* ── Base rotation arc (joint_1 indicator) ───────────────────────── */}
        <g>
          <line
            x1={BASE_X} y1={BASE_Y}
            x2={BASE_X + Math.sin(base1Angle) * 32}
            y2={BASE_Y - Math.cos(base1Angle) * 32}
            stroke="hsl(211 100% 38%)" strokeWidth="2.5"
            strokeLinecap="round" opacity={0.6}
          />
        </g>

        {/* ── Shadow / drop under arm ──────────────────────────────────────── */}
        <polyline
          points={points.slice(1).map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none" stroke="hsl(215 14% 70%)" strokeWidth="14"
          strokeLinecap="round" strokeLinejoin="round" opacity={0.15}
        />

        {/* ── Arm links ───────────────────────────────────────────────────── */}
        <polyline
          points={points.slice(1).map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="hsl(215 14% 78%)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={points.slice(1).map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="hsl(0 0% 97%)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ── Joint circles ───────────────────────────────────────────────── */}
        {points.slice(1, -1).map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={7}
              fill="hsl(215 20% 40%)" stroke="hsl(215 20% 28%)" strokeWidth="1.5" />
            <circle cx={x} cy={y} r={3}
              fill="hsl(215 20% 70%)" />
          </g>
        ))}

        {/* ── End effector ────────────────────────────────────────────────── */}
        <circle cx={endEffector[0]} cy={endEffector[1]} r={9}
          fill="hsl(211 100% 38%)" stroke="hsl(211 100% 28%)" strokeWidth="1.5" />
        <circle cx={endEffector[0]} cy={endEffector[1]} r={4}
          fill="hsl(211 100% 80%)" />

        {/* ── Base platform ───────────────────────────────────────────────── */}
        <ellipse cx={BASE_X} cy={BASE_Y} rx={22} ry={9}
          fill="hsl(215 20% 55%)" stroke="hsl(215 20% 40%)" strokeWidth="1.5" />
        <ellipse cx={BASE_X} cy={BASE_Y - 6} rx={16} ry={6}
          fill="hsl(215 20% 68%)" />

        {/* ── Coordinate labels ────────────────────────────────────────────── */}
        <text x={BASE_X + GRID_R * 0.92} y={BASE_Y + 14}
          fontSize="10" fill="hsl(215 12% 55%)" textAnchor="middle" fontFamily="monospace">
          {(GRID_R * 0.7).toFixed(0)} mm
        </text>

        {/* Joint_1 rotation label */}
        <text x={BASE_X + 38} y={BASE_Y - 4}
          fontSize="9" fill="hsl(211 100% 38%)" fontFamily="monospace" opacity={0.8}>
          J1
        </text>
      </svg>

      {/* End-effector XYZ readout (placeholder using raw joint data) */}
      <div className="absolute bottom-3 right-4 text-right">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">TCP</p>
        <p className="text-[10px] font-mono text-muted-foreground tabnum">
          X: {(endEffector[0] - BASE_X).toFixed(1)} Y: {(BASE_Y - endEffector[1]).toFixed(1)}
        </p>
      </div>
    </div>
  )
}
