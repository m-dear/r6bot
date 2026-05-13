import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RotateCcw } from 'lucide-react'
import * as THREE from 'three'
import { ROBOT_LINKS, type LinkDef } from '@/lib/robot-fk'
import type { JointData } from '@/types'

const URDF_JOINT_NAMES = ROBOT_LINKS.map((link) => link.jointName).filter((name): name is string => Boolean(name))
const CAMERA_HOME: [number, number, number] = [1.8, -1.8, 1.35]
const CAMERA_TARGET: [number, number, number] = [0.35, 0, 0.35]

function getUrdfJointAngles(joints: JointData[]): number[] {
  return URDF_JOINT_NAMES.map((name, i) => {
    const joint = joints.find((j) => j.name === name)
    return joint?.position ?? joints[i]?.position ?? 0
  })
}

// ── Individual link component — loads DAE and positions via FK ─────────────
interface DaeLinkProps {
  link: LinkDef
}

function smoothDaeMesh(mesh: THREE.Mesh) {
  const geometry = mesh.geometry
  if (geometry instanceof THREE.BufferGeometry && geometry.attributes.position) {
    geometry.computeVertexNormals()
    geometry.normalizeNormals()
  }

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach((material) => {
    const smoothMaterial = material as THREE.Material & { flatShading?: boolean }
    smoothMaterial.side = THREE.DoubleSide
    if ('flatShading' in smoothMaterial) smoothMaterial.flatShading = false
    smoothMaterial.needsUpdate = true
  })
}

function publicAssetUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, '')
  if (typeof document === 'undefined') return `/${normalizedPath}`

  const baseUrl = new URL(document.baseURI)
  const basePath = baseUrl.pathname.endsWith('/')
    ? baseUrl.pathname
    : baseUrl.pathname.replace(/\/[^/]*$/, '/')

  return `${basePath}${normalizedPath}`
}

function resolveMeshUrl(mesh: string) {
  if (/^(https?:)?\/\//.test(mesh)) return mesh

  const normalizedMesh = mesh.replace(/\\/g, '/')
  const packagePrefix = 'package://r6bot_description/'
  const descriptionPath = '/r6bot_description/'

  if (normalizedMesh.startsWith(packagePrefix)) {
    return publicAssetUrl(normalizedMesh.slice(packagePrefix.length))
  }

  const descriptionPathIndex = normalizedMesh.indexOf(descriptionPath)
  if (descriptionPathIndex >= 0) {
    return publicAssetUrl(normalizedMesh.slice(descriptionPathIndex + descriptionPath.length))
  }

  return publicAssetUrl(normalizedMesh)
}

function DaeLink({ link }: DaeLinkProps) {
  const meshUrl = resolveMeshUrl(link.mesh)
  const collada = useLoader(ColladaLoader, meshUrl)
  const scene = useMemo(() => {
    if (!collada) return null

    const clonedScene = collada.scene.clone(true)
    // ColladaLoader rotates Z_UP assets to Y_UP, but our scene uses Z_UP (ROS/URDF).
    // The vertex data stays in Z_UP — only the root rotation changes — so resetting it
    // puts the mesh back in the coordinate frame the FK values expect.
    clonedScene.rotation.set(0, 0, 0)
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        smoothDaeMesh(mesh)
      }
    })

    return clonedScene
  }, [collada])

  if (!scene) return null

  return (
    <group position={link.visualXYZ}>
      <primitive object={scene} />
    </group>
  )
}

function getAxisAngleQuaternion(axisXYZ: [number, number, number], angle: number) {
  const axis = new THREE.Vector3(...axisXYZ)
  if (axis.lengthSq() === 0) return new THREE.Quaternion()

  return new THREE.Quaternion().setFromAxisAngle(axis.normalize(), angle)
}

function getUrdfRpyQuaternion(rpy: [number, number, number]) {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rpy[0], rpy[1], rpy[2], 'ZYX')
  )
}

function UrdfLinkChain({ linkIndex, angles }: { linkIndex: number; angles: number[] }) {
  const link = ROBOT_LINKS[linkIndex]
  const jointIndex = linkIndex - 1
  const nextLinkIndex = linkIndex + 1

  if (!link) return null

  const angle = link.jointName ? (angles[jointIndex] ?? 0) : 0
  const originQuaternion = getUrdfRpyQuaternion(link.jointRPY)
  const jointQuaternion = getAxisAngleQuaternion(link.jointAxis, angle)

  if (!link.jointName) {
    return (
      <group name={link.linkName}>
        <Suspense fallback={null}>
          <DaeLink link={link} />
        </Suspense>
        {nextLinkIndex < ROBOT_LINKS.length && (
          <UrdfLinkChain linkIndex={nextLinkIndex} angles={angles} />
        )}
      </group>
    )
  }

  return (
    <group
      name={link.jointName}
      position={link.jointXYZ}
    >
      <group quaternion={originQuaternion}>
        <group name={link.linkName} quaternion={jointQuaternion}>
          <Suspense fallback={null}>
            <DaeLink link={link} />
          </Suspense>
          {nextLinkIndex < ROBOT_LINKS.length && (
            <UrdfLinkChain linkIndex={nextLinkIndex} angles={angles} />
          )}
        </group>
      </group>
    </group>
  )
}

// ── Robot assembly — nested exactly like the URDF parent/child chain ───────
function RobotAssembly({ joints }: { joints: JointData[] }) {
  const angles = getUrdfJointAngles(joints)
  return (
    <UrdfLinkChain linkIndex={0} angles={angles} />
  )
}

// ── Fallback skeleton shown while meshes are first loading ─────────────────
function LoadingRobot() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[0.05, 1.0, 0.05]} />
      <meshStandardMaterial color="#90A4AE" wireframe />
    </mesh>
  )
}

function WebGLFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background p-4">
      <div className="max-w-lg rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p className="font-semibold">3D view unavailable — WebGL context could not be created.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          The robot model files are fine. The browser asked the operating system for a hardware
          WebGL context on this display and the request was refused, so the 3D scene cannot start.
        </p>
        <p className="mt-3 text-xs font-semibold text-foreground">Most likely cause</p>
        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
          <li>
            This server is being viewed inside a <strong>headless or virtual display</strong>
            (Xvfb, x11vnc, xrdp, SSH X-forwarding). No GPU is bound to that display, so WebGL
            physically cannot run — even though the machine has a GPU.
          </li>
          <li>Or: browser hardware acceleration is disabled, or GPU drivers are missing / blocklisted.</li>
        </ul>
        <p className="mt-3 text-xs font-semibold text-foreground">How to fix</p>
        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
          <li>
            <strong>Open this URL from a machine that has a real display</strong> (laptop, desktop with
            a monitor). The dashboard is just served over HTTP — any browser on the LAN can connect.
          </li>
          <li>
            On this machine: enable “Use hardware acceleration when available” in browser settings,
            install GPU drivers, and avoid Snap-sandboxed browsers on hybrid GPUs.
          </li>
          <li>
            Last resort (slow, software WebGL):
            <code className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px]">
              google-chrome --enable-unsafe-swiftshader --ignore-gpu-blocklist
            </code>
          </li>
        </ul>
      </div>
    </div>
  )
}

function SceneQuality() {
  const { gl } = useThree()

  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.08
  }, [gl])

  return null
}

function InteractiveCamera({ resetToken }: { resetToken: number }) {
  const { camera, gl } = useThree()
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl])

  useEffect(() => {
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.enableZoom = true
    controls.minDistance = 0.35
    controls.maxDistance = 5
    controls.screenSpacePanning = false
    controls.target.set(...CAMERA_TARGET)
    controls.update()

    return () => controls.dispose()
  }, [controls])

  useEffect(() => {
    camera.position.set(...CAMERA_HOME)
    camera.up.set(0, 0, 1)
    controls.target.set(...CAMERA_TARGET)
    controls.update()
  }, [camera, controls, resetToken])

  useFrame(() => controls.update())

  return null
}

// ── Main 3D view component (exported) ─────────────────────────────────────
export function RobotView3D({ joints }: { joints: JointData[] }) {
  const [resetToken, setResetToken] = useState(0)

  return (
    <>
      <Canvas
        fallback={<WebGLFallback />}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: CAMERA_HOME, up: [0, 0, 1], fov: 42, near: 0.01, far: 20 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'hsl(240, 4.8%, 95.9%)' }}
      >
        <SceneQuality />
        <InteractiveCamera resetToken={resetToken} />

        {/* ── Lighting ────────────────────────────────────────────────── */}
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[3, 5, 4]}
          intensity={1.25}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-3, 3, -2]} intensity={0.45} />
        <spotLight
          position={[0.75, -1.1, 2.2]}
          angle={0.45}
          penumbra={0.45}
          intensity={1.4}
          distance={5}
          castShadow
        />
        <pointLight position={[-0.8, -0.6, 1.0]} intensity={0.35} />
        <hemisphereLight
          args={['#F8FBFF', '#B8C3D1', 0.4]}
        />

        <gridHelper args={[2.5, 25, '#A1A1AA', '#D4D4D8']} rotation={[Math.PI / 2, 0, 0]} />
        <axesHelper args={[0.35]} />

        {/* ── Robot arm ───────────────────────────────────────────────── */}
        {/* Render directly in URDF/ROS coordinates: X forward, Y left, Z up. */}
        <Suspense fallback={<LoadingRobot />}>
          <RobotAssembly joints={joints} />
        </Suspense>

      </Canvas>

      <button
        type="button"
        title="Reset 3D view"
        aria-label="Reset 3D view"
        onClick={() => setResetToken((token) => token + 1)}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </>
  )
}
