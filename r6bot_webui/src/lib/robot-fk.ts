import * as THREE from 'three'

// ── URDF joint & visual parameters from r6bot_description.urdf.xacro ──────
// All revolute joints rotate around Z axis (0 0 1).
// URDF fixed-axis RPY maps to THREE.Euler(roll, pitch, yaw, 'ZYX').

const PI = Math.PI

export interface LinkDef {
  /** URDF child link name for this visual mesh */
  linkName: string
  /** URDF parent link name; null for the world-fixed base visual */
  parentLinkName: string | null
  /** URDF joint that connects this link to its parent; null for fixed world base */
  jointName: string | null
  /** Joint origin: translation from parent link frame */
  jointXYZ: [number, number, number]
  /** Joint origin: rotation from parent link frame (roll, pitch, yaw) */
  jointRPY: [number, number, number]
  /** URDF joint axis in the joint frame */
  jointAxis: [number, number, number]
  /** true = fixed joint (no rotation applied) */
  isFixed: boolean
  /** Visual mesh origin offset in THIS link's joint frame */
  visualXYZ: [number, number, number]
  /** URL path for Vite dev server — served from public/meshes/ */
  mesh: string
}

export const ROBOT_LINKS: LinkDef[] = [
  // link_0 (base_link) — world → base_link, fixed
  {
    linkName: 'base_link',
    parentLinkName: null,
    jointName: null,
    jointXYZ:  [0, 0, 0],
    jointRPY:  [0, 0, 0],
    jointAxis: [0, 0, 1],
    isFixed:   true,
    visualXYZ: [0, 0, 0],
    mesh: '/meshes/visual/link_0.dae',
  },
  // link_1 — joint_1: xyz="0 0 0.244" rpy="0 0 0"
  {
    linkName: 'link_1',
    parentLinkName: 'base_link',
    jointName: 'joint_1',
    jointXYZ:  [0, 0, 0.244],
    jointRPY:  [0, 0, 0],
    jointAxis: [0, 0, 1],
    isFixed:   false,
    visualXYZ: [0, 0, -0.182],
    mesh: '/meshes/visual/link_1.dae',
  },
  // link_2 — joint_2: xyz="-0.27 0 0.0" rpy="-pi/2 -pi/2 pi/2"
  {
    linkName: 'link_2',
    parentLinkName: 'link_1',
    jointName: 'joint_2',
    jointXYZ:  [-0.27, 0, 0],
    jointRPY:  [-PI / 2, -PI / 2, PI / 2],
    jointAxis: [0, 0, 1],
    isFixed:   false,
    visualXYZ: [0, 0, -0.168],
    mesh: '/meshes/visual/link_2.dae',
  },
  // link_3 — joint_3: xyz="0.686 0 -0.27" rpy="0 pi pi+pi/2"
  {
    linkName: 'link_3',
    parentLinkName: 'link_2',
    jointName: 'joint_3',
    jointXYZ:  [0.686, 0, -0.27],
    jointRPY:  [0, PI, PI + PI / 2],
    jointAxis: [0, 0, 1],
    isFixed:   false,
    visualXYZ: [0, 0, -0.144],
    mesh: '/meshes/visual/link_3.dae',
  },
  // link_4 — joint_4: xyz="0.519 0 0" rpy="0 pi pi"
  {
    linkName: 'link_4',
    parentLinkName: 'link_3',
    jointName: 'joint_4',
    jointXYZ:  [0.519, 0, 0],
    jointRPY:  [0, PI, PI],
    jointAxis: [0, 0, 1],
    isFixed:   false,
    visualXYZ: [0, 0, 0.077],
    mesh: '/meshes/visual/link_4.dae',
  },
  // link_5 — joint_5: xyz="0 0 0.188" rpy="pi/2 pi pi/2"
  {
    linkName: 'link_5',
    parentLinkName: 'link_4',
    jointName: 'joint_5',
    jointXYZ:  [0, 0, 0.188],
    jointRPY:  [PI / 2, PI, PI / 2],
    jointAxis: [0, 0, 1],
    isFixed:   false,
    visualXYZ: [0, 0, 0.113],
    mesh: '/meshes/visual/link_5.dae',
  },
  // link_6 — joint_6: xyz="0 0 0.246" rpy="0 -pi/2 0"
  {
    linkName: 'link_6',
    parentLinkName: 'link_5',
    jointName: 'joint_6',
    jointXYZ:  [0, 0, 0.246],
    jointRPY:  [0, -PI / 2, 0],
    jointAxis: [0, 0, 1],
    isFixed:   false,
    visualXYZ: [0, 0, 0.086],
    mesh: '/meshes/visual/link_6.dae',
  },
]

// ── Forward kinematics ─────────────────────────────────────────────────────

function makeJointRotation(axisXYZ: [number, number, number], angle: number): THREE.Matrix4 {
  const axis = new THREE.Vector3(...axisXYZ)
  if (axis.lengthSq() === 0) return new THREE.Matrix4()

  return new THREE.Matrix4().makeRotationAxis(axis.normalize(), angle)
}

/**
 * Compute world-space visual transforms for all 7 links.
 * jointAngles: [j1…j6] in radians (indices match ros controller joint order).
 * Returns 7 THREE.Matrix4 values — one per ROBOT_LINKS entry.
 */
export function computeFK(jointAngles: number[]): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = []
  let worldT = new THREE.Matrix4()   // identity = world origin
  let ji = 0                         // index into jointAngles (skip fixed)

  for (const link of ROBOT_LINKS) {
    // 1. Joint origin translation (in parent frame)
    const Torg = new THREE.Matrix4().makeTranslation(...link.jointXYZ)

    // 2. Joint origin rotation — URDF fixed-axis RPY = THREE 'ZYX' Euler
    const Rorg = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(link.jointRPY[0], link.jointRPY[1], link.jointRPY[2], 'ZYX')
    )

    // 3. Joint rotation around the URDF axis in the joint frame
    const angle = link.isFixed ? 0 : (jointAngles[ji++] ?? 0)
    const Rj = makeJointRotation(link.jointAxis, angle)

    // 4. Accumulate: parent_world * T_origin * R_origin * R_joint
    worldT = new THREE.Matrix4().multiplyMatrices(worldT, Torg)
    worldT = new THREE.Matrix4().multiplyMatrices(worldT, Rorg)
    worldT = new THREE.Matrix4().multiplyMatrices(worldT, Rj)

    // 5. Visual mesh sits at visual_xyz offset within this link's frame
    const Tvis = new THREE.Matrix4().makeTranslation(...link.visualXYZ)
    const visualT = new THREE.Matrix4().multiplyMatrices(worldT, Tvis)

    out.push(visualT)
  }

  return out
}

/**
 * Compute the URDF joint-frame transforms for the serial chain.
 * These are useful for drawing the physical joint connection graph separately
 * from the visual mesh offsets.
 */
export function computeJointFrames(jointAngles: number[]): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = []
  let worldT = new THREE.Matrix4()
  let ji = 0

  for (const link of ROBOT_LINKS) {
    const Torg = new THREE.Matrix4().makeTranslation(...link.jointXYZ)
    const Rorg = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(link.jointRPY[0], link.jointRPY[1], link.jointRPY[2], 'ZYX')
    )
    const angle = link.isFixed ? 0 : (jointAngles[ji++] ?? 0)
    const Rj = makeJointRotation(link.jointAxis, angle)

    worldT = new THREE.Matrix4().multiplyMatrices(worldT, Torg)
    worldT = new THREE.Matrix4().multiplyMatrices(worldT, Rorg)
    worldT = new THREE.Matrix4().multiplyMatrices(worldT, Rj)

    out.push(worldT.clone())
  }

  return out
}

/** Decompose a Matrix4 into position + quaternion for React Three Fiber props */
export function decomposeMatrix(m: THREE.Matrix4): {
  position: [number, number, number]
  quaternion: [number, number, number, number]
} {
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  m.decompose(p, q, s)
  return {
    position: [p.x, p.y, p.z],
    quaternion: [q.x, q.y, q.z, q.w],
  }
}
