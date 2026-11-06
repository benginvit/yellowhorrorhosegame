import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { rasmusPositionAt, RASMUS_SEAT_POS, KNIFE_SHELF_POS, KIOSK_POS } from '../levels/ikeaLayout'
import { playFootstepSound } from '../utils/sounds'

const EASE = 10 // 1/s, exponential smoothing rate
const SIT_SPEED = 2.5 // world units/s when walking to the seat after the order is won
const STEP_LENGTH = 0.8 // world units between footsteps
const WALK_CYCLE = 7 // rad per world unit walked (leg swing)
const PICKUP_AT = 1.5 // s into the intro when the knife is taken from the shelf
const TURN_AT = 2.5 // s into the intro when he turns toward the kiosk
const TABLE_OFFSET = [-0.9, 0, 0] // table relative to RASMUS_SEAT_POS (he faces it)
const MEATBALLS = 16

const SKIN = '#fdd8b5'
const HAIR = '#5c3a21'
const SHIRT = '#cc1111'
const JEANS = '#2f4f8f'

const meatballPositions = Array.from({ length: MEATBALLS }, (_, i) => {
  const col = i % 4
  const row = Math.floor(i / 4)
  return [(col - 1.5) * 0.09, 0.05, (row - 1.5) * 0.09 - 0.03]
})

function Knife() {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.04, 0.14, 0.04]} />
        <meshStandardMaterial color="#3a2a1a" />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.025, 0.28, 0.07]} />
        <meshStandardMaterial color="#cfd3d8" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/**
 * Rasmus (Roblox/lowpoly style: sneaky side-swept fringe, red t-shirt, jeans). Carries a knife but never uses it.
 *
 * @param {object} props
 * @param {null|'intro'|'ordering'|'won'|'lost'} props.ikeaPhase  intro: takes the knife from the shelf and turns toward the
 *   kiosk; ordering: walks, looks at the player, footsteps; won: drops the knife, sits at RASMUS_SEAT_POS and eats;
 *   lost: stands at the player.
 * @param {number} props.progress  0..1 along RASMUS_PATH (1 - ikeaTimeLeft / IKEA_ORDER_SECONDS).
 *
 * The logical position is rasmusPositionAt(progress), a pure function of ikeaTimeLeft; the visual position (the group
 * named "rasmus", readable in tests via scene.getObjectByName('rasmus')) eases toward it in useFrame because progress
 * only changes every 0.25 s. No shadow casters on purpose.
 */
function Rasmus({ ikeaPhase, progress }) {
  const root = useRef() // world position
  const body = useRef() // facing (yaw) and sit offset
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const handKnife = useRef()
  const shelfKnife = useRef()
  const floorKnife = useRef()
  const tray = useRef()
  const camera = useThree((s) => s.camera)

  const walkRef = useRef({ dist: 0, sinceStep: 0, phaseStart: 0, phase: null, yaw: 0, sit: 0, lastX: 0, lastZ: 0 })

  const target = ikeaPhase === 'won' ? RASMUS_SEAT_POS : rasmusPositionAt(progress)

  // Start position only at mount: a position prop would reset the group on every render and defeat the easing.
  const [initial] = useState(() => target)

  useFrame((state, delta) => {
    const g = root.current
    if (!g) return
    const w = walkRef.current
    const t = state.clock.elapsedTime
    if (w.phase !== ikeaPhase) {
      w.phase = ikeaPhase
      w.phaseStart = t
      if (w.lastX === 0 && w.lastZ === 0) {
        w.lastX = g.position.x
        w.lastZ = g.position.z
      }
    }
    const inPhase = t - w.phaseStart

    const prevX = g.position.x
    const prevZ = g.position.z
    if (ikeaPhase === 'won') {
      // Walk to the seat at a steady pace.
      const dx = target[0] - prevX
      const dz = target[2] - prevZ
      const d = Math.hypot(dx, dz)
      const step = Math.min(d, SIT_SPEED * delta)
      if (d > 1e-4) {
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
      }
    } else {
      const k = 1 - Math.exp(-EASE * delta)
      g.position.x += (target[0] - prevX) * k
      g.position.z += (target[2] - prevZ) * k
    }
    const moved = Math.hypot(g.position.x - prevX, g.position.z - prevZ)
    const arrivedAtSeat = ikeaPhase === 'won' && Math.hypot(target[0] - g.position.x, target[2] - g.position.z) < 0.05
    const walking = moved > 1e-4 && !arrivedAtSeat

    // Facing
    let faceYaw = w.yaw
    const toward = (x, z) => Math.atan2(x - g.position.x, z - g.position.z)
    if (ikeaPhase === 'intro') {
      faceYaw = inPhase < TURN_AT ? toward(KNIFE_SHELF_POS[0], KNIFE_SHELF_POS[2] - 1) : toward(KIOSK_POS[0], KIOSK_POS[2])
    } else if (ikeaPhase === 'ordering' || ikeaPhase === 'lost') {
      faceYaw = toward(camera.position.x, camera.position.z)
    } else if (ikeaPhase === 'won') {
      faceYaw = arrivedAtSeat ? Math.atan2(TABLE_OFFSET[0], TABLE_OFFSET[2]) : walking ? toward(target[0], target[2]) : w.yaw
    }
    let dyaw = faceYaw - w.yaw
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw))
    w.yaw += dyaw * (1 - Math.exp(-8 * delta))
    body.current.rotation.y = w.yaw

    // Walk cycle
    w.dist += moved
    const swing = walking ? Math.sin(w.dist * WALK_CYCLE) * 0.7 : 0
    const sitTarget = arrivedAtSeat ? 1 : 0
    w.sit += (sitTarget - w.sit) * (1 - Math.exp(-6 * delta))
    body.current.position.y = -0.4 * w.sit
    legL.current.rotation.x = swing * (1 - w.sit) - 1.5 * w.sit
    legR.current.rotation.x = -swing * (1 - w.sit) - 1.5 * w.sit

    const holdsKnife = ikeaPhase !== 'won' && (ikeaPhase !== 'intro' || inPhase >= PICKUP_AT)
    const reaching = ikeaPhase === 'intro' && inPhase < PICKUP_AT
    // Right arm carries the knife out in front; left arm swings. While eating both hands go to the mouth.
    const eat = arrivedAtSeat ? -1.2 + Math.sin(t * 5) * 0.25 : 0
    armL.current.rotation.x = arrivedAtSeat ? eat : -swing
    armR.current.rotation.x = arrivedAtSeat ? eat : reaching ? -1.4 : holdsKnife ? -0.9 : swing

    handKnife.current.visible = holdsKnife
    shelfKnife.current.visible = ikeaPhase === 'intro' && inPhase < PICKUP_AT
    floorKnife.current.visible = arrivedAtSeat
    tray.current.visible = ikeaPhase === 'won' && arrivedAtSeat

    // Footsteps (positional: louder the further he has come, panned by his side of the camera)
    if (ikeaPhase === 'ordering' && walking) {
      w.sinceStep += moved
      if (w.sinceStep >= STEP_LENGTH) {
        w.sinceStep = 0
        const lx = g.position.x - camera.position.x
        const lz = g.position.z - camera.position.z
        const right = lx * Math.cos(camera.rotation.y) - lz * Math.sin(camera.rotation.y)
        const dist = Math.max(1, Math.hypot(lx, lz))
        try {
          playFootstepSound(0.04 + 0.5 * progress, right / dist)
        } catch {
          // audio unavailable (e.g. no user gesture yet): footsteps are optional
        }
      }
    }
  })

  return (
    <group ref={root} name="rasmus" position={[initial[0], 0, initial[2]]}>
      <group ref={body}>
        {/* Legs (jeans), pivot at the hip */}
        <group ref={legL} position={[-0.12, 0.7, 0]}>
          <mesh position={[0, -0.35, 0]}>
            <boxGeometry args={[0.2, 0.7, 0.22]} />
            <meshStandardMaterial color={JEANS} />
          </mesh>
        </group>
        <group ref={legR} position={[0.12, 0.7, 0]}>
          <mesh position={[0, -0.35, 0]}>
            <boxGeometry args={[0.2, 0.7, 0.22]} />
            <meshStandardMaterial color={JEANS} />
          </mesh>
        </group>

        {/* Torso (red t-shirt) */}
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.5, 0.7, 0.28]} />
          <meshStandardMaterial color={SHIRT} />
        </mesh>

        {/* Arms: red sleeve + skin, pivot at the shoulder. Right arm holds the knife. */}
        <group ref={armL} position={[-0.36, 1.35, 0]}>
          <mesh position={[0, -0.15, 0]}>
            <boxGeometry args={[0.18, 0.3, 0.2]} />
            <meshStandardMaterial color={SHIRT} />
          </mesh>
          <mesh position={[0, -0.45, 0]}>
            <boxGeometry args={[0.16, 0.3, 0.18]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
        </group>
        <group ref={armR} position={[0.36, 1.35, 0]}>
          <mesh position={[0, -0.15, 0]}>
            <boxGeometry args={[0.18, 0.3, 0.2]} />
            <meshStandardMaterial color={SHIRT} />
          </mesh>
          <mesh position={[0, -0.45, 0]}>
            <boxGeometry args={[0.16, 0.3, 0.18]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
          <group ref={handKnife} position={[0, -0.6, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <Knife />
          </group>
        </group>

        {/* Head with a side-swept fringe over the forehead */}
        <group position={[0, 1.6, 0]}>
          <mesh>
            <boxGeometry args={[0.4, 0.4, 0.4]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
          <mesh position={[0, 0.2, -0.02]}>
            <boxGeometry args={[0.44, 0.1, 0.44]} />
            <meshStandardMaterial color={HAIR} />
          </mesh>
          <mesh position={[-0.02, 0.14, 0.2]} rotation={[0, 0, -0.35]}>
            <boxGeometry args={[0.46, 0.1, 0.06]} />
            <meshStandardMaterial color={HAIR} />
          </mesh>
          <mesh position={[-0.1, 0.03, 0.205]} rotation={[0, 0, -0.35]}>
            <boxGeometry args={[0.2, 0.07, 0.03]} />
            <meshStandardMaterial color={HAIR} />
          </mesh>
          <mesh position={[-0.09, 0, 0.201]}>
            <boxGeometry args={[0.06, 0.06, 0.01]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
          <mesh position={[0.09, 0, 0.201]}>
            <boxGeometry args={[0.06, 0.06, 0.01]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
        </group>
      </group>

      {/* The knife on the shelf until he picks it up (he stands at the shelf during the intro, so this is relative to him) */}
      <group ref={shelfKnife} position={[0, 1, -1]}>
        <Knife />
      </group>
      {/* Dropped knife once he sits down to eat */}
      <mesh ref={floorKnife} position={[0.3, 0.03, 0.4]} rotation={[0, 0.8, 0]} visible={false}>
        <boxGeometry args={[0.05, 0.02, 0.4]} />
        <meshStandardMaterial color="#cfd3d8" />
      </mesh>

      {/* Table with the tray: 16 meatballs and mashed potatoes. Table position is fixed relative to the seat. */}
      <group ref={tray} position={TABLE_OFFSET} visible={false}>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[1.0, 0.05, 1.0]} />
          <meshStandardMaterial color="#c9a36b" />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[0.08, 0.7, 0.08]} />
          <meshStandardMaterial color="#8a6a3b" />
        </mesh>
        <group position={[0, 0.725, 0]}>
          <mesh position={[0, 0.01, 0]}>
            <boxGeometry args={[0.6, 0.02, 0.5]} />
            <meshStandardMaterial color="#e8e8e8" />
          </mesh>
          <mesh position={[0.2, 0.06, 0]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial color="#f1e3b0" />
          </mesh>
          {meatballPositions.map((p, i) => (
            <mesh key={i} position={[p[0] - 0.1, p[1] + 0.02, p[2]]}>
              <sphereGeometry args={[0.04, 8, 6]} />
              <meshStandardMaterial color="#7a3b1d" />
            </mesh>
          ))}
        </group>
      </group>

      {/* Red glow as on the other characters (no shadows) */}
      <pointLight position={[0, 1.2, 0]} intensity={0.5} distance={3} color="#ff0000" />
    </group>
  )
}

export default Rasmus
