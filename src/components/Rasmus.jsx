import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { rasmusPositionAt, RASMUS_SEAT_POS, KNIFE_SHELF_POS, KIOSK_POS, IKEA_WRONG_DRINK_MS } from '../levels/ikeaLayout'
import { playFootstepSound } from '../utils/sounds'

const EASE = 10 // 1/s, exponential smoothing rate
const SIT_SPEED = 2.5 // world units/s when walking to the seat after the order is done
const RUN_MIN_SPEED = 3 // world units/s, the slowest he runs at the player after a wrong drink
const RUN_STOP = 1 // he stops this far from the player
const STAND_MS = 300 // wrong drink: he pushes up from the chair before he runs
const STAB_MS = 600 // wrong drink: the overhead knife stab at the end of IKEA_WRONG_DRINK_MS
const SEATED_PHASES = ['serve', 'drink', 'deliverDrink', 'won']
const EATING_PHASES = ['drink', 'deliverDrink'] // the tray is on the table (IkeaServing draws it) and he eats from it
const STEP_LENGTH = 0.8 // world units between footsteps
const WALK_CYCLE = 7 // rad per world unit walked (leg swing)
const PICKUP_AT = 1.5 // s into the intro when the knife is taken from the shelf
const TURN_AT = 2.5 // s into the intro when he turns toward the kiosk
const SEAT_YAW = Math.PI / 2 // he sits facing +x, toward the table
const _right = new Vector3()
const clamp01 = (v) => Math.min(1, Math.max(0, v))

const SKIN = '#fdd8b5'
const HAIR = '#5c3a21'
const SHIRT = '#cc1111'
const JEANS = '#2f4f8f'

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
 * Rasmus (Roblox/lowpoly style: sneaky side-swept fringe, red t-shirt, jeans). Carries a knife.
 *
 * @param {object} props
 * @param {null|'intro'|'ordering'|'serve'|'drink'|'deliverDrink'|'won'|'lost'} props.ikeaPhase  intro: takes the knife from
 *   the shelf and turns toward the kiosk; ordering: walks heavily toward the player, knife raised, head on the player, footsteps;
 *   serve: lowers (but keeps) the knife, walks to RASMUS_SEAT_POS, sits and drums his fingers; drink / deliverDrink: eats
 *   (the tray on the table is drawn by IkeaServing), looks up when `drinkAsked`; won: drinks, pleased; lost: stands at the
 *   player, or with loseReason 'wrongDrink' stands up, runs at the player and stabs (timed to IKEA_WRONG_DRINK_MS).
 * @param {number} props.progress  0..1 along RASMUS_PATH (1 - ikeaTimeLeft / IKEA_ORDER_SECONDS).
 * @param {null|'timeout'|'wrongDrink'} [props.loseReason]
 * @param {boolean} [props.drinkAsked]  he has said "Lingondryck" (ikeaDrinkAsked, true from 'drink' + ~2 s); he looks up from his food at the player
 * @param {() => void} [props.onSeated]  called once when he has sat down in 'serve' (App then allows serving)
 *
 * The logical position is rasmusPositionAt(progress), a pure function of ikeaTimeLeft; the visual position (the group
 * named "rasmus", readable in tests via scene.getObjectByName('rasmus')) eases toward it in useFrame because progress
 * only changes every 0.25 s. No shadow casters on purpose.
 */
function Rasmus({ ikeaPhase, progress, loseReason = null, drinkAsked = false, onSeated }) {
  const root = useRef() // world position
  const body = useRef() // facing (yaw) and sit offset
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const handKnife = useRef()
  const shelfKnife = useRef()
  const head = useRef()
  const smile = useRef()
  const camera = useThree((s) => s.camera)

  const walkRef = useRef({ dist: 0, sinceStep: 0, phaseStart: 0, phase: null, yaw: 0, sit: 0, seatedReported: false })

  const seatedPhase = SEATED_PHASES.includes(ikeaPhase)
  const running = ikeaPhase === 'lost' && loseReason === 'wrongDrink'
  const target = seatedPhase ? RASMUS_SEAT_POS : rasmusPositionAt(progress)

  // Start position only at mount: a position prop would reset the group on every render and defeat the easing.
  // (a test start straight into 'serve' has him walk in from the end of the path instead of already sitting)
  const [initial] = useState(() => (ikeaPhase === 'serve' ? rasmusPositionAt(1) : target))

  useFrame((state, delta) => {
    const g = root.current
    if (!g) return
    const w = walkRef.current
    const t = state.clock.elapsedTime
    if (w.phase !== ikeaPhase) {
      w.phase = ikeaPhase
      w.phaseStart = t
      // Constant pace to the seat, fast enough to be seated within 2.5 s even from the far end of the path.
      if (seatedPhase) w.sitSpeed = Math.max(SIT_SPEED, Math.hypot(RASMUS_SEAT_POS[0] - g.position.x, RASMUS_SEAT_POS[2] - g.position.z) / 2.5)
      // He reaches the player just as the stab starts, so the run takes IKEA_WRONG_DRINK_MS minus the stand-up and the stab.
      if (running) {
        const runDist = Math.max(0, Math.hypot(camera.position.x - g.position.x, camera.position.z - g.position.z) - RUN_STOP)
        w.runSpeed = Math.max(RUN_MIN_SPEED, runDist / ((IKEA_WRONG_DRINK_MS - STAND_MS - STAB_MS) / 1000))
      }
    }
    const inPhase = t - w.phaseStart

    const prevX = g.position.x
    const prevZ = g.position.z
    const standing = running && inPhase * 1000 < STAND_MS
    if ((seatedPhase || running) && !standing) {
      // Walk to the seat (or run at the player) at a steady pace.
      const goalX = running ? camera.position.x : target[0]
      const goalZ = running ? camera.position.z : target[2]
      const dx = goalX - prevX
      const dz = goalZ - prevZ
      const d = Math.max(0, Math.hypot(dx, dz) - (running ? RUN_STOP : 0))
      const full = Math.hypot(dx, dz)
      const step = Math.min(d, (running ? w.runSpeed : w.sitSpeed) * delta)
      if (full > 1e-4 && step > 0) {
        g.position.x += (dx / full) * step
        g.position.z += (dz / full) * step
      }
    } else {
      const k = 1 - Math.exp(-EASE * delta)
      g.position.x += (target[0] - prevX) * k
      g.position.z += (target[2] - prevZ) * k
    }
    const moved = Math.hypot(g.position.x - prevX, g.position.z - prevZ)
    const arrivedAtSeat = seatedPhase && Math.hypot(target[0] - g.position.x, target[2] - g.position.z) < 0.05
    const walking = moved > 1e-4 && !arrivedAtSeat

    // Facing
    let faceYaw = w.yaw
    const toward = (x, z) => Math.atan2(x - g.position.x, z - g.position.z)
    if (ikeaPhase === 'intro') {
      faceYaw = inPhase < TURN_AT ? toward(KNIFE_SHELF_POS[0], KNIFE_SHELF_POS[2] - 1) : toward(KIOSK_POS[0], KIOSK_POS[2])
    } else if (ikeaPhase === 'ordering' || ikeaPhase === 'lost') {
      faceYaw = toward(camera.position.x, camera.position.z)
    } else if (seatedPhase) {
      faceYaw = arrivedAtSeat ? SEAT_YAW : walking ? toward(target[0], target[2]) : w.yaw
    }
    let dyaw = faceYaw - w.yaw
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw))
    w.yaw += dyaw * (1 - Math.exp(-8 * delta))
    body.current.rotation.y = w.yaw

    // Walk cycle. Under 'ordering' the gait is heavy: a dip on every step and a slow sway from side to side.
    w.dist += moved
    const stomp = ikeaPhase === 'ordering' && walking
    const swing = walking ? Math.sin(w.dist * WALK_CYCLE) * (running ? 1.1 : stomp ? 0.55 : 0.7) : 0
    const sitTarget = arrivedAtSeat ? 1 : 0
    w.sit += (sitTarget - w.sit) * (1 - Math.exp(-6 * delta))
    body.current.position.y = -0.4 * w.sit - (stomp ? Math.abs(Math.sin(w.dist * WALK_CYCLE)) * 0.07 : 0)
    body.current.rotation.z = stomp ? Math.sin(w.dist * WALK_CYCLE) * 0.06 : 0
    legL.current.rotation.x = swing * (1 - w.sit) - 1.5 * w.sit
    legR.current.rotation.x = -swing * (1 - w.sit) - 1.5 * w.sit

    const holdsKnife = ikeaPhase !== 'intro' || inPhase >= PICKUP_AT
    const reaching = ikeaPhase === 'intro' && inPhase < PICKUP_AT
    const stabP = running ? clamp01((inPhase * 1000 - (IKEA_WRONG_DRINK_MS - STAB_MS)) / STAB_MS) : 0
    const eating = EATING_PHASES.includes(ikeaPhase) && arrivedAtSeat
    const sipping = ikeaPhase === 'won' && arrivedAtSeat
    const sip = (Math.sin(t * 1.5) + 1) / 2

    // Right arm carries the knife: out in front while he stalks, lowered (never dropped) once he is serving, overhead for the stab.
    // The left arm swings, drums on the table while he waits, goes to the mouth while he eats and drinks.
    let armRx = swing
    if (reaching) armRx = -1.4
    else if (running) armRx = -2.4 + 2.5 * stabP
    else if (seatedPhase) armRx = (walking ? 0.4 : 0.2) + swing * 0.2
    else if (holdsKnife) armRx = -0.9 + Math.sin(t * 2) * 0.03
    let armLx = -swing
    if (arrivedAtSeat) {
      if (sipping) armLx = -1.0 - 0.8 * sip
      else if (eating) armLx = -1.2 + Math.sin(t * 5) * 0.25
      else armLx = -1.35 + Math.sin(t * 16) * 0.1
    }
    armL.current.rotation.x = armLx
    armR.current.rotation.x = armRx
    handKnife.current.visible = holdsKnife
    shelfKnife.current.visible = ikeaPhase === 'intro' && inPhase < PICKUP_AT

    // Head: on the player as far as his neck allows. Down at the food until he has asked for the drink, then up at the player.
    let headYaw = 0
    if (ikeaPhase !== 'intro') {
      const rel = toward(camera.position.x, camera.position.z) - w.yaw
      headYaw = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(rel), Math.cos(rel))))
    }
    let headPitch = 0
    if (ikeaPhase === 'ordering') headPitch = 0.2 // chin down, glaring from under the fringe
    else if (eating) headPitch = drinkAsked ? -0.1 : 0.35 + Math.sin(t * 5) * 0.08
    else if (sipping) headPitch = -0.15 - 0.3 * sip
    else if (running) headPitch = 0.1
    const kHead = 1 - Math.exp(-8 * delta)
    head.current.rotation.y += (headYaw - head.current.rotation.y) * kHead
    head.current.rotation.x += (headPitch - head.current.rotation.x) * kHead
    smile.current.visible = ikeaPhase === 'won'

    if (arrivedAtSeat && ikeaPhase === 'serve' && !w.seatedReported) {
      w.seatedReported = true
      onSeated?.()
    }

    // Footsteps (positional: louder the further he has come, panned by his side of the camera)
    if (ikeaPhase === 'ordering' && walking) {
      w.sinceStep += moved
      if (w.sinceStep >= STEP_LENGTH) {
        w.sinceStep = 0
        const lx = g.position.x - camera.position.x
        const lz = g.position.z - camera.position.z
        // The camera's right vector from its quaternion (camera.rotation uses the default 'XYZ' order while Player sets the quaternion from a 'YXZ' yaw/pitch, so rotation.y is not the yaw)
        _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
        const right = lx * _right.x + lz * _right.z
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
        <group ref={head} position={[0, 1.6, 0]}>
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
          <group ref={smile} position={[0, -0.1, 0.201]} visible={false}>
            <mesh position={[0, -0.01, 0]}>
              <boxGeometry args={[0.14, 0.025, 0.01]} />
              <meshStandardMaterial color="#222222" />
            </mesh>
            {[-0.08, 0.08].map((x) => (
              <mesh key={x} position={[x, 0.01, 0]}>
                <boxGeometry args={[0.025, 0.04, 0.01]} />
                <meshStandardMaterial color="#222222" />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* The knife on the shelf row until he picks it up (he stands at KNIFE_SHELF_POS in the intro; the row is 0.6 behind him) */}
      <group ref={shelfKnife} position={[0.25, 1.3, -0.6]}>
        <Knife />
      </group>
      {/* Red glow as on the other characters (no shadows) */}
      <pointLight position={[0, 1.2, 0]} intensity={0.5} distance={3} color="#ff0000" />
    </group>
  )
}

export default Rasmus
