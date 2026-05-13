import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const radToDeg = (rad: number): number => (rad * 180) / Math.PI
export const degToRad = (deg: number): number => (deg * Math.PI) / 180

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export const formatDeg = (rad: number): string =>
  radToDeg(rad).toFixed(1) + '°'

export const formatRad = (rad: number): string => rad.toFixed(4) + ' rad'

export const formatVelocity = (vel: number): string => {
  const abs = Math.abs(vel)
  if (abs < 0.001) return '— 0.000'
  return (vel >= 0 ? '↑' : '↓') + ' ' + abs.toFixed(3)
}
