import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function House({ onEnter, hasKey, isAstridLevel = false }) {
  const doorRef = useRef()
  const { camera } = useThree()

  useFrame(() => {
    if (doorRef.current) {
      const doorPos = doorRef.current.getWorldPosition(new THREE.Vector3())
      const distance = camera.position.distanceTo(doorPos)

      // For Astrid level, can enter without key
      // For other levels, need key
      if (distance < 3 && (isAstridLevel || hasKey)) {
        onEnter()
      }
    }
  })

  return (
    <group position={[0, 0, -25]}>
      {/* Main walls - yellow brick */}
      <mesh position={[0, 4, 0]} castShadow receiveShadow>
        <boxGeometry args={[15, 8, 15]} />
        <meshStandardMaterial color="#ffeb3b" />
      </mesh>

      {/* Orange roof */}
      <mesh position={[0, 10, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[11, 4, 4]} />
        <meshStandardMaterial color="#ff6b00" />
      </mesh>

      {/* Door - brown */}
      <mesh ref={doorRef} position={[0, 2, 7.6]} castShadow>
        <boxGeometry args={[2.5, 4.5, 0.3]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Door frame - darker */}
      <mesh position={[0, 2, 7.8]} castShadow>
        <boxGeometry args={[3, 5, 0.2]} />
        <meshStandardMaterial color="#654321" />
      </mesh>

      {/* Windows - light blue */}
      <mesh position={[-4.5, 4, 7.6]}>
        <boxGeometry args={[2, 2, 0.2]} />
        <meshStandardMaterial color="#87CEEB" />
      </mesh>

      <mesh position={[4.5, 4, 7.6]}>
        <boxGeometry args={[2, 2, 0.2]} />
        <meshStandardMaterial color="#87CEEB" />
      </mesh>

      {/* Window on side */}
      <mesh position={[7.6, 4, 0]}>
        <boxGeometry args={[0.2, 2, 2]} />
        <meshStandardMaterial color="#87CEEB" />
      </mesh>

      <mesh position={[-7.6, 4, 0]}>
        <boxGeometry args={[0.2, 2, 2]} />
        <meshStandardMaterial color="#87CEEB" />
      </mesh>

      {/* Chimney */}
      <mesh position={[5, 11, -5]} castShadow>
        <boxGeometry args={[1.5, 3, 1.5]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  )
}

export default House
