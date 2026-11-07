import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Tray, Glass } from './IkeaServing'

const OFFSET = [0.28, -0.32, -0.7] // camera space: right, down, forward

/**
 * What the player carries, drawn in front of the camera (the tray with 16 meatballs and mash, or a glass of lingonberry drink; the models live in IkeaServing).
 *
 * @param {object} props
 * @param {null|'tray'|'drink'} props.carrying  ikeaCarrying; renders nothing for null
 */
function CarriedItem({ carrying }) {
  const group = useRef()
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.position.set(...OFFSET).applyQuaternion(camera.quaternion).add(camera.position)
    g.quaternion.copy(camera.quaternion)
  })

  if (!carrying) return null
  return (
    <group ref={group} name="carried-item">
      {carrying === 'tray' ? (
        <group scale={0.75} rotation={[0.12, 0, 0]}>
          <Tray />
        </group>
      ) : (
        <group position={[0, -0.08, 0]} scale={1.3}>
          <Glass />
        </group>
      )}
    </group>
  )
}

export default CarriedItem
