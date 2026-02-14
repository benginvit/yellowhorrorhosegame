import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function Furniture({ position, type, onPlayerNear }) {
  const furnitureRef = useRef()
  const { camera } = useThree()

  useFrame(() => {
    if (furnitureRef.current) {
      const furniturePos = furnitureRef.current.getWorldPosition(new THREE.Vector3())
      const distance = camera.position.distanceTo(furniturePos)

      // Check if player is hiding behind furniture
      if (distance < 3) {
        onPlayerNear(true)
      } else {
        onPlayerNear(false)
      }
    }
  })

  const getFurniture = () => {
    switch (type) {
      case 'sofa':
        return (
          <group ref={furnitureRef} position={position}>
            {/* Sofa base */}
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[3, 0.8, 1.2]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Sofa back */}
            <mesh position={[0, 1, -0.4]} castShadow>
              <boxGeometry args={[3, 1.2, 0.4]} />
              <meshStandardMaterial color="#A0522D" />
            </mesh>
            {/* Armrests */}
            <mesh position={[-1.3, 0.7, 0]} castShadow>
              <boxGeometry args={[0.4, 1, 1.2]} />
              <meshStandardMaterial color="#A0522D" />
            </mesh>
            <mesh position={[1.3, 0.7, 0]} castShadow>
              <boxGeometry args={[0.4, 1, 1.2]} />
              <meshStandardMaterial color="#A0522D" />
            </mesh>
          </group>
        )

      case 'table':
        return (
          <group ref={furnitureRef} position={position}>
            {/* Table top */}
            <mesh position={[0, 0.8, 0]} castShadow>
              <boxGeometry args={[2, 0.1, 1.5]} />
              <meshStandardMaterial color="#D2691E" />
            </mesh>
            {/* Legs */}
            <mesh position={[-0.8, 0.4, -0.6]} castShadow>
              <boxGeometry args={[0.1, 0.8, 0.1]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[0.8, 0.4, -0.6]} castShadow>
              <boxGeometry args={[0.1, 0.8, 0.1]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[-0.8, 0.4, 0.6]} castShadow>
              <boxGeometry args={[0.1, 0.8, 0.1]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[0.8, 0.4, 0.6]} castShadow>
              <boxGeometry args={[0.1, 0.8, 0.1]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
          </group>
        )

      case 'bookshelf':
        return (
          <group ref={furnitureRef} position={position}>
            {/* Main shelf */}
            <mesh position={[0, 1.2, 0]} castShadow>
              <boxGeometry args={[2, 2.4, 0.5]} />
              <meshStandardMaterial color="#654321" />
            </mesh>
            {/* Shelves */}
            <mesh position={[0, 0.6, 0.1]} castShadow>
              <boxGeometry args={[1.9, 0.05, 0.4]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[0, 1.2, 0.1]} castShadow>
              <boxGeometry args={[1.9, 0.05, 0.4]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[0, 1.8, 0.1]} castShadow>
              <boxGeometry args={[1.9, 0.05, 0.4]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Books */}
            <mesh position={[-0.5, 0.7, 0.15]} castShadow>
              <boxGeometry args={[0.2, 0.3, 0.15]} />
              <meshStandardMaterial color="#ff0000" />
            </mesh>
            <mesh position={[-0.2, 0.7, 0.15]} castShadow>
              <boxGeometry args={[0.15, 0.3, 0.15]} />
              <meshStandardMaterial color="#0000ff" />
            </mesh>
            <mesh position={[0.1, 0.7, 0.15]} castShadow>
              <boxGeometry args={[0.18, 0.3, 0.15]} />
              <meshStandardMaterial color="#00ff00" />
            </mesh>
          </group>
        )

      case 'bed':
        return (
          <group ref={furnitureRef} position={position}>
            {/* Bed frame */}
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[2.5, 0.3, 4]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Mattress */}
            <mesh position={[0, 0.6, 0]} castShadow>
              <boxGeometry args={[2.3, 0.3, 3.8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Pillow */}
            <mesh position={[0, 0.8, -1.5]} castShadow>
              <boxGeometry args={[1, 0.2, 0.8]} />
              <meshStandardMaterial color="#f0f0f0" />
            </mesh>
            {/* Blanket */}
            <mesh position={[0, 0.75, 0.5]} castShadow>
              <boxGeometry args={[2.2, 0.15, 3]} />
              <meshStandardMaterial color="#4169E1" />
            </mesh>
          </group>
        )

      default:
        return null
    }
  }

  return getFurniture()
}

export default Furniture
