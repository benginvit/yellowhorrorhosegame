import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeatballTray, LingonGlass } from './IkeaServing'

// Camera space offsets: right, down, forward. The tray is held with both hands low in front; the glass in the right hand.
const TRAY_OFFSET = [0.05, -0.34, -0.62]
const GLASS_OFFSET = [0.26, -0.3, -0.5]
const GLASS_MAX_NDC_X = 0.6

// Keeps the glass inside the frustum on narrow (portrait) screens; wider views keep GLASS_OFFSET unchanged.
function glassOffset(camera) {
  const depth = -GLASS_OFFSET[2]
  const halfWidth = depth * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect
  return [Math.min(GLASS_OFFSET[0], GLASS_MAX_NDC_X * halfWidth), GLASS_OFFSET[1], GLASS_OFFSET[2]]
}

/**
 * What the player carries (ikeaCarrying), drawn in front of the camera: the tray with the meatballs or the glass of
 * lingonberry drink (models shared with IkeaServing). Follows the camera exactly (no bob), so a frozen frame is fixed.
 *
 * @param {object} props
 * @param {null|'tray'|'drink'} props.carrying  renders nothing for null
 */
function CarriedItem({ carrying }) {
  const group = useRef()
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    const g = group.current
    if (!g) return
    const offset = carrying === 'tray' ? TRAY_OFFSET : glassOffset(camera)
    g.position.set(...offset).applyQuaternion(camera.quaternion).add(camera.position)
    g.quaternion.copy(camera.quaternion)
  })

  if (!carrying) return null
  return (
    <group ref={group} name="carried-item">
      {carrying === 'tray' ? (
        <group scale={0.8} rotation={[0.15, 0, 0]}>
          <MeatballTray />
        </group>
      ) : (
        <LingonGlass />
      )}
    </group>
  )
}

export default CarriedItem
