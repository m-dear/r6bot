export interface JointData {
  name: string
  position: number   // radians
  velocity: number   // rad/s
}

export interface RobotWebSocketState {
  connected: boolean
  joints: JointData[]
  messageCount: number
  hz: number
  lastUpdate: number | null
  isMoving: boolean
  ros2DriverConnected: boolean
  sendCommand: (positionsRad: number[], speedPercent?: number) => void
}

export interface BridgeJointStateMsg {
  type: 'joint_states'
  names: string[]
  positions: number[]
  velocities: number[]
  ros2_driver: boolean
}
