import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

const OFFSET = [0.28, -0.32, -0.7] // camera space: right, down, forward

/**
 * What the player carries, drawn in front of the camera (placeholder boxes). Stage 2 replaces the models, not the contract.
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
        <>
          <mesh>
            <boxGeometry args={[0.5, 0.03, 0.35]} />
            <meshStandardMaterial color="#e8e8e8" />
          </mesh>
          <mesh position={[0.05, 0.06, 0]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color="#7a3b1d" />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.05, 0.04, 0.16, 12]} />
          <meshStandardMaterial color="#b3122f" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  )
}

export default CarriedItem
