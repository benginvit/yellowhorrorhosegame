import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { rasmusPositionAt, RASMUS_SEAT_POS } from '../levels/ikeaLayout'

const EASE = 10 // 1/s, exponential smoothing rate

/**
 * Rasmus (red t-shirt, carries a knife while walking).
 *
 * @param {object} props
 * @param {null|'intro'|'ordering'|'won'|'lost'} props.ikeaPhase  intro: stands at the knife shelf; ordering: walks;
 *   won: drops the knife, sits at RASMUS_SEAT_POS and eats; lost: stands at the player.
 * @param {number} props.progress  0..1 along RASMUS_PATH (1 - ikeaTimeLeft / IKEA_ORDER_SECONDS).
 *
 * The logical position is rasmusPositionAt(progress); the visual position eases toward it in
 * useFrame because progress only changes every 0.25 s.
 * STUB: red capsule. Stage 2 replaces the content, not the contract.
 */
function Rasmus({ ikeaPhase, progress }) {
  const ref = useRef()
  const target = ikeaPhase === 'won' ? RASMUS_SEAT_POS : rasmusPositionAt(progress)

  // Start position only at mount: a position prop would reset the group on every render and defeat the easing.
  const [initial] = useState(() => target)

  useFrame((_, delta) => {
    if (!ref.current) return
    const k = 1 - Math.exp(-EASE * delta)
    ref.current.position.x += (target[0] - ref.current.position.x) * k
    ref.current.position.z += (target[2] - ref.current.position.z) * k
  })

  return (
    <group ref={ref} position={[initial[0], 0, initial[2]]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.35, 1.1, 4, 8]} />
        <meshStandardMaterial color="#cc1111" />
      </mesh>
    </group>
  )
}

export default Rasmus
