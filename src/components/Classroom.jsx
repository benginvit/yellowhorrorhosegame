import { Text } from '@react-three/drei'
import { useLightFlicker } from '../utils/flicker'
import {
  CLASSROOM, CLASSROOM_WALL, CLASSROOM_HEIGHT, CLASSROOM_DOOR, DESK_COLUMNS_X, DESK_ROWS_Z, PLAYER_DESK, DESK_TOP, STUDENT_CHAIR, TEACHER_DESK, CLASSROOM_BOOKSHELF,
} from '../levels/classroomLayout'

function CeilingPointLight({ intensity, ...props }) {
  const ref = useLightFlicker(intensity)
  return <pointLight ref={ref} intensity={intensity} {...props} />
}

function Classroom() {
  // Room: x: -9 to 9, z: -8 to 6, y: 0 to 4 (levels/classroomLayout.js; the collision boxes come from the same layout)
  const floorColor = '#c8c0b0'
  const wallColor = '#f0ede8'
  const ceilingColor = '#ffffff'

  const roomWidth = CLASSROOM.maxX - CLASSROOM.minX

  return (
    <group>
      {/* Floor - linoleum tiles */}
      <mesh position={[0, 0, -1]} receiveShadow>
        <boxGeometry args={[18, 0.1, 15]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 4, -1]} receiveShadow>
        <boxGeometry args={[18, 0.1, 15]} />
        <meshStandardMaterial color={ceilingColor} />
      </mesh>

      {/* Front wall (with whiteboard) */}
      <mesh position={[0, CLASSROOM_HEIGHT / 2, CLASSROOM.minZ]} receiveShadow>
        <boxGeometry args={[roomWidth, 4.2, CLASSROOM_WALL]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, CLASSROOM_HEIGHT / 2, CLASSROOM.maxZ]} receiveShadow>
        <boxGeometry args={[roomWidth, 4.2, CLASSROOM_WALL]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Left wall */}
      <mesh position={[CLASSROOM.minX, CLASSROOM_HEIGHT / 2, -1]} receiveShadow>
        <boxGeometry args={[CLASSROOM_WALL, 4.2, 15]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Right wall */}
      <mesh position={[CLASSROOM.maxX, CLASSROOM_HEIGHT / 2, -1]} receiveShadow>
        <boxGeometry args={[CLASSROOM_WALL, 4.2, 15]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Whiteboard */}
      <mesh position={[0, 2.2, -7.8]} castShadow>
        <boxGeometry args={[10, 2, 0.1]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      {/* Whiteboard frame */}
      <mesh position={[0, 2.2, -7.75]}>
        <boxGeometry args={[10.2, 2.2, 0.05]} />
        <meshStandardMaterial color="#888888" />
      </mesh>

      {/* "Pops Academy" text on whiteboard */}
      <Text
        position={[0, 2.8, -7.7]}
        fontSize={0.45}
        color="#1a1a8c"
        fontWeight="bold"
        anchorX="center"
        anchorY="middle"
      >
        POPS ACADEMY
      </Text>

      {/* Subtitle on whiteboard */}
      <Text
        position={[0, 2.2, -7.7]}
        fontSize={0.22}
        color="#444444"
        anchorX="center"
        anchorY="middle"
      >
        Matematiklektion - Kap. 7
      </Text>

      {/* Math on whiteboard */}
      <Text
        position={[-2, 1.6, -7.7]}
        fontSize={0.18}
        color="#333333"
        anchorX="center"
        anchorY="middle"
      >
        {'2x + 5 = 13   →   x = 4'}
      </Text>

      {/* Windows on left wall */}
      {[-3, 1, 5].map((z, i) => (
        <group key={i}>
          <mesh position={[-8.85, 2.5, z]}>
            <boxGeometry args={[0.1, 1.8, 2]} />
            <meshStandardMaterial color="#87ceeb" transparent opacity={0.5} />
          </mesh>
          {/* Window frame */}
          <mesh position={[-8.8, 2.5, z]}>
            <boxGeometry args={[0.1, 1.95, 2.15]} />
            <meshStandardMaterial color="#cccccc" wireframe />
          </mesh>
        </group>
      ))}

      {/* Classroom door on right wall */}
      <mesh position={[CLASSROOM_DOOR.x, CLASSROOM_DOOR.y, CLASSROOM_DOOR.z]}>
        <boxGeometry args={[CLASSROOM_DOOR.depth, CLASSROOM_DOOR.height, CLASSROOM_DOOR.width]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
      <Text
        position={[8.5, 3.2, CLASSROOM_DOOR.z]}
        rotation={[0, -Math.PI / 2, 0]}
        fontSize={0.18}
        color="#555555"
        anchorX="center"
      >
        UTGÅNG
      </Text>

      {/* Fluorescent ceiling lights */}
      {[-4, 0, 4].map((x, i) => (
        <group key={i} position={[x, 3.9, -1]}>
          <mesh>
            <boxGeometry args={[0.2, 0.05, 3]} />
            <meshStandardMaterial color="#fffde0" emissive="#fffde0" emissiveIntensity={0.8} />
          </mesh>
          <CeilingPointLight intensity={0.3} distance={9} color="#fffde0" position={[0, -0.1, 0]} />
        </group>
      ))}

      {/* Teacher's desk at front */}
      <group position={TEACHER_DESK.position}>
        {/* Desk surface */}
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[TEACHER_DESK.w, 0.1, TEACHER_DESK.d]} />
          <meshStandardMaterial color="#8B6914" />
        </mesh>
        {/* Desk legs */}
        {[[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.3], [1.1, 0.3]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.4, z]} castShadow>
            <boxGeometry args={[0.1, 0.8, 0.1]} />
            <meshStandardMaterial color="#6B4F0A" />
          </mesh>
        ))}
        {/* Chair */}
        <mesh position={[0, 0.45, TEACHER_DESK.chair.z]} castShadow>
          <boxGeometry args={[TEACHER_DESK.chair.size, 0.08, TEACHER_DESK.chair.size]} />
          <meshStandardMaterial color="#444444" />
        </mesh>
      </group>

      {/* Student desks */}
      {DESK_ROWS_Z.map(z =>
        DESK_COLUMNS_X.map(x => {
          const isPlayerDesk = x === PLAYER_DESK.x && z === PLAYER_DESK.z
          return (
            <group key={`desk-${x}-${z}`} position={[x, 0, z]}>
              {/* Desk top */}
              <mesh position={[0, 0.72, 0]} castShadow>
                <boxGeometry args={[DESK_TOP.w, 0.07, DESK_TOP.d]} />
                <meshStandardMaterial color={isPlayerDesk ? '#c4a35a' : '#b8955a'} />
              </mesh>
              {/* Desk leg */}
              <mesh position={[0, 0.36, 0]} castShadow>
                <boxGeometry args={[0.08, 0.72, 0.08]} />
                <meshStandardMaterial color="#888888" />
              </mesh>
              {/* Chair */}
              {!isPlayerDesk && (
                <>
                  <mesh position={[0, 0.42, STUDENT_CHAIR.seatZ]} castShadow>
                    <boxGeometry args={[STUDENT_CHAIR.w, 0.06, STUDENT_CHAIR.seatD]} />
                    <meshStandardMaterial color="#555555" />
                  </mesh>
                  <mesh position={[0, 0.78, STUDENT_CHAIR.backZ]} castShadow>
                    <boxGeometry args={[STUDENT_CHAIR.w, 0.65, STUDENT_CHAIR.backD]} />
                    <meshStandardMaterial color="#555555" />
                  </mesh>
                </>
              )}
            </group>
          )
        })
      )}

      {/* Bookshelf on back wall */}
      <mesh position={CLASSROOM_BOOKSHELF.position} castShadow>
        <boxGeometry args={[CLASSROOM_BOOKSHELF.w, 2, CLASSROOM_BOOKSHELF.d]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
      {/* Books on shelf */}
      {[0.3, 0.6, 0.9, 1.2, 1.5].map((x, i) => (
        <mesh key={i} position={[-8.2 + x, 1.6, 5.65]} castShadow>
          <boxGeometry args={[0.22, 0.8, 0.25]} />
          <meshStandardMaterial color={['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22'][i]} />
        </mesh>
      ))}

      {/* Swedish flag on wall */}
      <mesh position={[7, 3, -7.8]} castShadow>
        <boxGeometry args={[1, 0.65, 0.05]} />
        <meshStandardMaterial color="#006AA7" />
      </mesh>
      <mesh position={[7, 2.97, -7.78]}>
        <boxGeometry args={[0.08, 0.55, 0.06]} />
        <meshStandardMaterial color="#FECC02" />
      </mesh>
      <mesh position={[7, 2.97, -7.78]}>
        <boxGeometry args={[1.05, 0.1, 0.06]} />
        <meshStandardMaterial color="#FECC02" />
      </mesh>
    </group>
  )
}

export default Classroom
