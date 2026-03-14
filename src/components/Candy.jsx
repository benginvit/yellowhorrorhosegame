import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const COLORS = ['#ff3366', '#33ccff', '#ffcc00', '#ff6600', '#cc33ff', '#00cc66', '#ff99cc', '#ffdd00', '#ff4444', '#44ffaa']
const SHAPES = ['round', 'round', 'lollipop', 'bar', 'round', 'lollipop', 'round', 'bar', 'round', 'lollipop']

// One candy piece that flies from teacher and lands on floor
function CandyPiece({ id, x, z, eaten, delay = 0, onCollectedByPlayer }) {
  const groupRef = useRef()
  const progress = useRef(0)
  const started = useRef(false)
  const elapsed = useRef(0)
  const landed = useRef(false)
  const { camera } = useThree()

  const color = COLORS[id % COLORS.length]
  const shape = SHAPES[id % SHAPES.length]

  const teacherPos = new THREE.Vector3(0, 1.2, -6.5)
  const endPos = new THREE.Vector3(x, 0.45, z)

  useFrame((state, delta) => {
    if (!groupRef.current || eaten) return

    elapsed.current += delta
    if (elapsed.current < delay) return
    if (!started.current) started.current = true

    if (!landed.current) {
      progress.current = Math.min(1, progress.current + delta * 1.2)
      const t = progress.current

      // Smooth arc flight
      groupRef.current.position.x = THREE.MathUtils.lerp(teacherPos.x, endPos.x, t)
      groupRef.current.position.z = THREE.MathUtils.lerp(teacherPos.z, endPos.z, t)
      groupRef.current.position.y = THREE.MathUtils.lerp(teacherPos.y, endPos.y, t) + Math.sin(t * Math.PI) * 2.5
      groupRef.current.rotation.x += delta * 5
      groupRef.current.rotation.z += delta * 3

      if (progress.current >= 1) landed.current = true
    } else {
      // Hover and spin on floor
      groupRef.current.position.y = endPos.y + Math.sin(state.clock.elapsedTime * 2 + id) * 0.06
      groupRef.current.rotation.y += delta * 1.5

      // Player proximity
      const dist = camera.position.distanceTo(new THREE.Vector3(x, 1, z))
      if (dist < 1.8) {
        onCollectedByPlayer(id)
      }
    }
  })

  if (eaten) return null

  return (
    <group ref={groupRef} position={[teacherPos.x, teacherPos.y, teacherPos.z]}>
      {shape === 'round' && (
        <mesh castShadow>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshStandardMaterial color={color} metalness={0.2} roughness={0.3} />
        </mesh>
      )}
      {shape === 'lollipop' && (
        <>
          <mesh castShadow>
            <sphereGeometry args={[0.16, 10, 10]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, -0.25, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.35, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </>
      )}
      {shape === 'bar' && (
        <>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.1, 0.16]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.26, 0.04, 0.13]} />
            <meshStandardMaterial color="#f5d78e" />
          </mesh>
        </>
      )}
      <pointLight intensity={0.6} distance={2} color={color} />
    </group>
  )
}

export const CANDY_POSITIONS = [
  { id: 0, x: -6, z: -4 },
  { id: 1, x: -2, z: -4 },
  { id: 2, x:  3, z: -4 },
  { id: 3, x:  6, z: -3 },
  { id: 4, x: -5, z: -1 },
  { id: 5, x:  0, z: -1 },
  { id: 6, x:  5, z:  0 },
  { id: 7, x: -6, z:  2 },
  { id: 8, x:  3, z:  3 },
  { id: 9, x: -3, z:  4 },
]

function Candy({ pieces, onCollectedByPlayer }) {
  return (
    <>
      {pieces.map((p, i) => (
        <CandyPiece
          key={p.id}
          id={p.id}
          x={p.x}
          z={p.z}
          eaten={p.eaten || p.collectedByPlayer}
          delay={i * 0.18}
          onCollectedByPlayer={onCollectedByPlayer}
        />
      ))}
    </>
  )
}

export default Candy
