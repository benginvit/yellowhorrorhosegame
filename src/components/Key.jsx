import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function Key({ onCollect }) {
  const keyRef = useRef()
  const { camera } = useThree()

  useFrame((state) => {
    if (keyRef.current) {
      // Rotate the key
      keyRef.current.rotation.y += 0.02

      // Hover up and down
      keyRef.current.position.y = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.3

      // Check if player is close enough to collect
      const keyPos = keyRef.current.getWorldPosition(new THREE.Vector3())
      const distance = camera.position.distanceTo(keyPos)

      if (distance < 2) {
        onCollect()
      }
    }
  })

  return (
    <group ref={keyRef} position={[8, 1, -10]}>
      {/* Key shaft */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 2]} />
        <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Key ring */}
      <mesh position={[-1, 0, 0]}>
        <torusGeometry args={[0.4, 0.08, 16, 100]} />
        <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Key teeth */}
      <mesh position={[1, 0, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.1]} />
        <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Additional teeth detail */}
      <mesh position={[1.15, 0.15, 0]}>
        <boxGeometry args={[0.3, 0.1, 0.1]} />
        <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Glow effect */}
      <pointLight intensity={2} distance={5} color="#ffd700" />
    </group>
  )
}

export default Key
