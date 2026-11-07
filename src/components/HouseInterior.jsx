import { useLightFlicker } from '../utils/flicker'
import { HOUSE_POSITION, HOUSE_HEIGHT, HOUSE_DOOR, INTERIOR_SIZE, INTERIOR_WALL, INTERIOR_WALL_AT } from '../levels/houseLayout'

// Width of each front wall segment beside the doorway.
const FRONT_SEGMENT = INTERIOR_SIZE / 2 - HOUSE_DOOR.width / 2

function HouseInterior() {
  const lampRef = useLightFlicker(0.4)
  return (
    <group position={HOUSE_POSITION}>
      {/* Floor */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[INTERIOR_SIZE, 0.1, INTERIOR_SIZE]} />
        <meshStandardMaterial color="#D2B48C" />
      </mesh>

      {/* Walls (the collision boxes come from the same layout, see levels/colliders/houseInterior.js) */}
      {/* Back wall */}
      <mesh position={[0, HOUSE_HEIGHT / 2, -INTERIOR_WALL_AT]} receiveShadow>
        <boxGeometry args={[INTERIOR_SIZE, HOUSE_HEIGHT, INTERIOR_WALL]} />
        <meshStandardMaterial color="#FFF8DC" />
      </mesh>

      {/* Left wall */}
      <mesh position={[-INTERIOR_WALL_AT, HOUSE_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[INTERIOR_WALL, HOUSE_HEIGHT, INTERIOR_SIZE]} />
        <meshStandardMaterial color="#FFF8DC" />
      </mesh>

      {/* Right wall */}
      <mesh position={[INTERIOR_WALL_AT, HOUSE_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[INTERIOR_WALL, HOUSE_HEIGHT, INTERIOR_SIZE]} />
        <meshStandardMaterial color="#FFF8DC" />
      </mesh>

      {/* Front wall: two segments beside the doorway (same width as the front door, House.jsx) and the lintel above it */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (HOUSE_DOOR.width / 2 + FRONT_SEGMENT / 2), HOUSE_HEIGHT / 2, INTERIOR_WALL_AT]} receiveShadow>
          <boxGeometry args={[FRONT_SEGMENT, HOUSE_HEIGHT, INTERIOR_WALL]} />
          <meshStandardMaterial color="#FFF8DC" />
        </mesh>
      ))}
      <mesh position={[0, HOUSE_DOOR.height + (HOUSE_HEIGHT - HOUSE_DOOR.height) / 2, INTERIOR_WALL_AT]} receiveShadow>
        <boxGeometry args={[HOUSE_DOOR.width, HOUSE_HEIGHT - HOUSE_DOOR.height, INTERIOR_WALL]} />
        <meshStandardMaterial color="#FFF8DC" />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, HOUSE_HEIGHT, 0]} receiveShadow>
        <boxGeometry args={[INTERIOR_SIZE, 0.2, INTERIOR_SIZE]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>

      {/* Lights */}
      <pointLight ref={lampRef} position={[0, 6, 0]} intensity={0.4} distance={16} color="#FFE4B5" />

      {/* Ceiling lamp */}
      <mesh position={[0, 7, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
      </mesh>

      {/* Pictures on walls */}
      <mesh position={[0, 5, -6.9]} castShadow>
        <boxGeometry args={[1.5, 2, 0.1]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      <mesh position={[-6.9, 5, -3]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[1.5, 2, 0.1]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      {/* Rug */}
      <mesh position={[0, 0.11, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
    </group>
  )
}

export default HouseInterior
