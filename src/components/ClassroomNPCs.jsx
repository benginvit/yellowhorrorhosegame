import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function SeatedStudent({ deskPosition, hairColor, panicPhase }) {
  const groupRef = useRef()
  const offset = useRef(Math.random() * Math.PI * 2)

  useFrame((state) => {
    if (!groupRef.current) return
    if (panicPhase === 'shots') {
      const t = state.clock.elapsedTime
      groupRef.current.position.y = Math.abs(Math.sin(t * 9 + offset.current)) * 0.4
      groupRef.current.rotation.y = Math.sin(t * 12 + offset.current) * 0.35
    } else {
      groupRef.current.position.y = 0
    }
  })

  return (
    <group ref={groupRef} position={deskPosition}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.55, 0.8, 0.35]} />
        <meshStandardMaterial color="#4a6fa5" />
      </mesh>
      <mesh position={[0, 1.75, 0]} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial color="#fdd8b5" />
      </mesh>
      <mesh position={[0, 2.05, 0]} castShadow>
        <boxGeometry args={[0.58, 0.2, 0.58]} />
        <meshStandardMaterial color={hairColor} />
      </mesh>
      <mesh position={[0, 1.1, 0.45]}>
        <boxGeometry args={[0.55, 0.6, 0.05]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
    </group>
  )
}

// Student that runs toward nearest available candy and eats it
function RunningStudent({ startX, startZ, hairColor, candyPieces, onCandyEaten, studentIndex }) {
  const groupRef = useRef()
  const leftLegRef = useRef()
  const rightLegRef = useRef()
  const leftArmRef = useRef()
  const rightArmRef = useRef()

  const pos = useRef(new THREE.Vector3(startX, 0, startZ))
  const target = useRef(null)
  const targetCandyId = useRef(null)
  const yaw = useRef(Math.random() * Math.PI * 2)
  const offset = useRef(Math.random() * Math.PI * 2)
  // Not all students go for candy — alternating pattern
  const goesForCandy = useRef(studentIndex % 3 !== 2)
  const hasEaten = useRef(false)
  const speed = useRef(2.2 + Math.random() * 1.8)

  function getRandomWanderTarget() {
    return new THREE.Vector3(-7 + Math.random() * 14, 0, -6 + Math.random() * 11)
  }

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Find nearest available candy if this student goes for candy and hasn't eaten yet
    if (goesForCandy.current && !hasEaten.current && candyPieces && candyPieces.length > 0) {
      const available = candyPieces.filter(p => !p.eaten && !p.collectedByPlayer)
      if (available.length > 0) {
        // Pick nearest
        let nearest = null
        let nearestDist = Infinity
        for (const piece of available) {
          const d = Math.hypot(piece.x - pos.current.x, piece.z - pos.current.z)
          if (d < nearestDist) {
            nearestDist = d
            nearest = piece
          }
        }
        if (nearest) {
          target.current = new THREE.Vector3(nearest.x, 0, nearest.z)
          targetCandyId.current = nearest.id
        }
      } else {
        // No candy left, wander
        if (!target.current) target.current = getRandomWanderTarget()
      }
    } else if (!target.current) {
      target.current = getRandomWanderTarget()
    }

    const tgt = target.current || getRandomWanderTarget()
    const dx = tgt.x - pos.current.x
    const dz = tgt.z - pos.current.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 0.4) {
      // Reached candy — eat it
      if (goesForCandy.current && !hasEaten.current && targetCandyId.current !== null) {
        const candyStillAvailable = candyPieces &&
          candyPieces.find(p => p.id === targetCandyId.current && !p.eaten && !p.collectedByPlayer)
        if (candyStillAvailable) {
          hasEaten.current = true
          onCandyEaten(targetCandyId.current)
        }
        targetCandyId.current = null
      }
      target.current = getRandomWanderTarget()
    } else {
      const nx = dx / dist
      const nz = dz / dist
      pos.current.x += nx * speed.current * delta
      pos.current.z += nz * speed.current * delta
      yaw.current = Math.atan2(nx, nz)
    }

    groupRef.current.position.x = pos.current.x
    groupRef.current.position.z = pos.current.z
    groupRef.current.rotation.y = yaw.current
    groupRef.current.position.y = Math.abs(Math.sin(t * 10 + offset.current)) * 0.12

    const legSwing = Math.sin(t * 10 + offset.current) * 0.7
    if (leftLegRef.current) leftLegRef.current.rotation.x = legSwing
    if (rightLegRef.current) rightLegRef.current.rotation.x = -legSwing
    if (leftArmRef.current) leftArmRef.current.rotation.x = -legSwing * 0.6
    if (rightArmRef.current) rightArmRef.current.rotation.x = legSwing * 0.6
  })

  return (
    <group ref={groupRef} position={[startX, 0, startZ]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.55, 0.85, 0.35]} />
        <meshStandardMaterial color="#4a6fa5" />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial color="#fdd8b5" />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[0.58, 0.2, 0.58]} />
        <meshStandardMaterial color={hairColor} />
      </mesh>
      <group ref={leftArmRef} position={[-0.38, 1.1, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color="#fdd8b5" />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.38, 1.1, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color="#fdd8b5" />
        </mesh>
      </group>
      <group ref={leftLegRef} position={[-0.15, 0.4, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.22, 0.65, 0.22]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.15, 0.4, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.22, 0.65, 0.22]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
      </group>
    </group>
  )
}

function NPCTeacher({ isPanicking }) {
  return (
    <group position={[0, 0, -5.8]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.75, 1.9, 0.4]} />
        <meshStandardMaterial color="#2c3e7a" />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow>
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshStandardMaterial color="#fdd8b5" />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[0.77, 0.22, 0.77]} />
        <meshStandardMaterial color="#f5e6a8" />
      </mesh>
      {!isPanicking && (
        <mesh position={[0.55, 1.5, -0.3]} rotation={[Math.PI / 6, 0, -Math.PI / 8]} castShadow>
          <boxGeometry args={[0.04, 1.5, 0.04]} />
          <meshStandardMaterial color="#8B6914" />
        </mesh>
      )}
    </group>
  )
}

function ClassroomNPCs({ panicPhase, candyPieces, onCandyEaten }) {
  const studentPositionsX = [-6, -3, 0, 3, 6]
  const studentPositionsZ = [-4, -1, 2]
  const hairColors = ['#5c3a21', '#f5e6a8', '#1a1a1a', '#b5651d', '#8B6914', '#c0392b']

  const isRunning = panicPhase === 'panic' || panicPhase === 'active'
  const isShotsPhase = panicPhase === 'shots'

  let studentIndex = 0

  return (
    <>
      <NPCTeacher isPanicking={isShotsPhase || isRunning} />

      {studentPositionsZ.map(z =>
        studentPositionsX.map((x, xi) => {
          const isPlayerDesk = x === 0 && z === 2
          if (isPlayerDesk) return null

          const hairColor = hairColors[(xi + studentPositionsZ.indexOf(z)) % hairColors.length]
          const key = `student-${x}-${z}`
          const idx = studentIndex++

          if (isRunning) {
            return (
              <RunningStudent
                key={key}
                startX={x}
                startZ={z}
                hairColor={hairColor}
                candyPieces={candyPieces}
                onCandyEaten={onCandyEaten}
                studentIndex={idx}
              />
            )
          }

          return (
            <SeatedStudent
              key={key}
              deskPosition={[x, 0, z]}
              hairColor={hairColor}
              panicPhase={panicPhase}
            />
          )
        })
      )}
    </>
  )
}

export default ClassroomNPCs
