import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { rasmusPositionAt, RASMUS_PATH, RASMUS_SEAT_POS, KNIFE_SHELF_POS, KIOSK_POS, IKEA_WRONG_DRINK_MS } from '../levels/ikeaLayout'
import { playFootstepSound } from '../utils/sounds'

const EASE = 10 // 1/s, exponential smoothing rate of the visual position toward the logical one (ordering)
const POSE_RATE = 8 // 1/s, smoothing of the pose (joints) and the body yaw
const SEAT_TIME = 3.2 // s: from the end of the order to the seat, whatever the distance (App's fallback marks him seated at 4 s)
const SIT_SPEED_MIN = 3 // world units/s: never slower than this on the way to the seat
// He walks the rest of RASMUS_PATH, then around the counter to this point behind his chair, then into the seat.
const SEAT_APPROACH = [RASMUS_SEAT_POS[0] - 1.6, 0, RASMUS_SEAT_POS[2] + 0.8]
const ATTACK_S = IKEA_WRONG_DRINK_MS / 1000 // the whole wrong-drink sequence: rise, run, stab; then App shows the jumpscare
const RISE_S = 0.35 // s standing up from the chair before the run
const RUN_UNTIL = 0.7 // fraction of ATTACK_S by which he has reached the player; the stab fills the rest
const STAB_WINDUP_S = 0.3 // s with the knife raised before it comes down
const RUN_SPEED_MIN = 4 // world units/s
const RUN_STOP = 1.1 // he stops this far from the camera (close enough to fill the view, far enough for the stab to be seen)
const SEATED_PHASES = ['serve', 'drink', 'deliverDrink', 'won']
const STEP_LENGTH = 0.8 // world units between footsteps
const WALK_CYCLE = 7 // rad per world unit walked (leg swing)
const PICKUP_AT = 1.5 // s into the intro when the knife is taken from the shelf
const TURN_AT = 2.5 // s into the intro when he turns toward the kiosk
const SEAT_YAW = Math.PI / 2 // he sits facing +x, toward the table
const SIT_DROP = 0.2 // body offset when sitting: hip from 0.7 to 0.5, on the chair seat (0.46) in IkeaStore
const HEAD_MAX_YAW = 1.3 // rad the head turns relative to the body (looking at the player)
const ARM_TABLE = -1.05 // forearm resting on the table top when seated
const ARM_MOUTH = -2.4 // hand at the mouth (eating, drinking)
const KNIFE_ALONG = Math.PI // blade continues the arm (pointing at the player when the arm is raised, down when it hangs, flat on the table)
const KNIFE_ACROSS = Math.PI / 2 // blade across the arm (overhead grip for the stab, upright in the intro)
const _right = new Vector3()

const SKIN = '#fdd8b5'
const HAIR = '#5c3a21'
const SHIRT = '#cc1111'
const JEANS = '#2f4f8f'

// Cumulative length of RASMUS_PATH at each waypoint (for the walk to the seat).
const PATH_ENDS = []
{
  let acc = 0
  for (let i = 1; i < RASMUS_PATH.length; i++) {
    acc += Math.hypot(RASMUS_PATH[i][0] - RASMUS_PATH[i - 1][0], RASMUS_PATH[i][2] - RASMUS_PATH[i - 1][2])
    PATH_ENDS.push(acc)
  }
}

/** Arc length along RASMUS_PATH of the point on the path closest to (x, z). */
function pathArcLengthNear(x, z) {
  let best = Infinity
  let bestS = 0
  for (let i = 1; i < RASMUS_PATH.length; i++) {
    const [ax, , az] = RASMUS_PATH[i - 1]
    const [bx, , bz] = RASMUS_PATH[i]
    const len = Math.hypot(bx - ax, bz - az)
    const t = len === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (len * len)))
    const d = Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z)
    if (d < best) {
      best = d
      bestS = (i === 1 ? 0 : PATH_ENDS[i - 2]) + t * len
    }
  }
  return bestS
}

/** Waypoints from (x, z) to the seat: the rest of RASMUS_PATH (so he never cuts through the counter), the approach point, the seat. */
function seatRoute(x, z) {
  const s = pathArcLengthNear(x, z)
  const route = []
  for (let i = 1; i < RASMUS_PATH.length; i++) if (PATH_ENDS[i - 1] > s + 0.3) route.push(RASMUS_PATH[i])
  route.push(SEAT_APPROACH, RASMUS_SEAT_POS)
  return route
}

function routeLength(x, z, route) {
  let len = 0
  for (const [px, , pz] of route) {
    len += Math.hypot(px - x, pz - z)
    x = px
    z = pz
  }
  return len
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

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
 * Rasmus (Roblox/lowpoly style: sneaky side-swept fringe, red t-shirt, jeans). Carries a knife and never lets go of it.
 *
 * @param {object} props
 * @param {null|'intro'|'ordering'|'serve'|'drink'|'deliverDrink'|'won'|'lost'} props.ikeaPhase
 *   intro: takes the knife from the shelf and turns toward the kiosk;
 *   ordering: stalks along RASMUS_PATH toward the player (heavy leaning walk, knife pointed at the player, head on the
 *     player, footsteps that grow with the distance walked);
 *   serve: knife lowered, walks the rest of the path and around the counter to RASMUS_SEAT_POS, sits (onSeated once),
 *     then waits drumming his fingers, eyes on the player;
 *   drink: eats from the tray (IkeaServing draws it) until drinkAsked, then looks up at the player;
 *   deliverDrink: waits, looking at the player;
 *   won: drinks from the glass on the table, content;
 *   lost: with loseReason 'wrongDrink' he stands up, runs at the player and stabs, timed to IKEA_WRONG_DRINK_MS
 *     (App's jumpscare follows); otherwise (timeout) he stands at the end of the path facing the player.
 * @param {number} props.progress  0..1 along RASMUS_PATH (1 - ikeaTimeLeft / IKEA_ORDER_SECONDS).
 * @param {null|'timeout'|'wrongDrink'} [props.loseReason]
 * @param {boolean} [props.drinkAsked]  he has said "Lingondryck" (ikeaDrinkAsked, set by App with the voice clip)
 * @param {() => void} [props.onSeated]  called once when he has sat down in 'serve' (App then allows serving)
 *
 * The logical position during the order is rasmusPositionAt(progress), a pure function of ikeaTimeLeft; the visual
 * position (the group named "rasmus", readable in tests via scene.getObjectByName('rasmus')) eases toward it in useFrame
 * because progress only changes every 0.25 s. Every animation is a function of the R3F clock and the frame delta, so a
 * frozen clock gives a fixed pose. No shadow casters on purpose.
 */
function Rasmus({ ikeaPhase, progress, loseReason = null, drinkAsked = false, onSeated }) {
  const root = useRef() // world position
  const body = useRef() // facing (yaw), lean and sit offset
  const head = useRef()
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const handKnife = useRef()
  const shelfKnife = useRef()
  const camera = useThree((s) => s.camera)

  const seatedPhase = SEATED_PHASES.includes(ikeaPhase)
  const attacking = ikeaPhase === 'lost' && loseReason === 'wrongDrink'
  const target = rasmusPositionAt(progress) // logical position on the path (intro, ordering, lost by timeout)

  // Start position only at mount: a position prop would reset the group on every render and defeat the easing.
  // A test start straight into a seated phase (?phase=): 'serve' walks in from the end of the path, later phases sit already.
  const [initial] = useState(() => (ikeaPhase === 'serve' ? rasmusPositionAt(1) : seatedPhase ? RASMUS_SEAT_POS : target))
  const sitsAtMount = seatedPhase && ikeaPhase !== 'serve'
  const walkRef = useRef({
    phase: null,
    phaseStart: 0,
    dist: 0,
    sinceStep: 0,
    yaw: sitsAtMount ? SEAT_YAW : 0,
    route: null,
    routeIdx: 0,
    speed: 0,
    runSpeed: null,
    atSeat: sitsAtMount,
    seatedReported: false,
    pose: null, // eased joint values, initialised from the first frame's targets
  })

  useFrame((state, delta) => {
    const g = root.current
    if (!g) return
    const w = walkRef.current
    const t = state.clock.elapsedTime
    if (w.phase !== ikeaPhase) {
      w.phase = ikeaPhase
      w.phaseStart = t
      if (attacking) {
        w.route = null
        w.atSeat = false
        w.runSpeed = null
      } else if (seatedPhase && !w.atSeat && !w.route) {
        w.route = seatRoute(g.position.x, g.position.z)
        w.routeIdx = 0
        w.speed = Math.max(SIT_SPEED_MIN, routeLength(g.position.x, g.position.z, w.route) / SEAT_TIME)
      }
    }
    const inPhase = t - w.phaseStart
    const toward = (x, z) => Math.atan2(x - g.position.x, z - g.position.z)
    const prevX = g.position.x
    const prevZ = g.position.z

    // --- Movement and body facing
    let faceYaw = w.yaw
    if (attacking) {
      if (inPhase >= RISE_S) {
        const dx = camera.position.x - prevX
        const dz = camera.position.z - prevZ
        const full = Math.hypot(dx, dz)
        const d = Math.max(0, full - RUN_STOP)
        // Paced so that he is at the player when the stab starts, however far away he was.
        if (w.runSpeed === null) w.runSpeed = Math.max(RUN_SPEED_MIN, d / Math.max(0.2, ATTACK_S * RUN_UNTIL - RISE_S))
        const step = Math.min(d, w.runSpeed * delta)
        if (full > 1e-4 && step > 0) {
          g.position.x += (dx / full) * step
          g.position.z += (dz / full) * step
        }
      }
      faceYaw = toward(camera.position.x, camera.position.z)
    } else if (seatedPhase) {
      if (w.route && w.routeIdx < w.route.length) {
        let budget = w.speed * delta
        while (budget > 0 && w.routeIdx < w.route.length) {
          const [tx, , tz] = w.route[w.routeIdx]
          const dx = tx - g.position.x
          const dz = tz - g.position.z
          const full = Math.hypot(dx, dz)
          if (full <= budget) {
            g.position.x = tx
            g.position.z = tz
            budget -= full
            w.routeIdx++
          } else {
            g.position.x += (dx / full) * budget
            g.position.z += (dz / full) * budget
            budget = 0
          }
        }
        if (w.routeIdx < w.route.length) {
          const [tx, , tz] = w.route[w.routeIdx]
          faceYaw = toward(tx, tz)
        }
      }
      if (!w.route || w.routeIdx >= w.route.length) w.atSeat = true
      if (w.atSeat) faceYaw = SEAT_YAW
    } else {
      const k = 1 - Math.exp(-EASE * delta)
      g.position.x += (target[0] - prevX) * k
      g.position.z += (target[2] - prevZ) * k
      if (ikeaPhase === 'intro') {
        faceYaw = inPhase < TURN_AT ? toward(KNIFE_SHELF_POS[0], KNIFE_SHELF_POS[2] - 1) : toward(KIOSK_POS[0], KIOSK_POS[2])
      } else if (ikeaPhase === 'ordering' && progress < 1) {
        // The body follows the path; the head is on the player.
        const ahead = rasmusPositionAt(Math.min(1, progress + 0.02))
        faceYaw = Math.atan2(ahead[0] - target[0], ahead[2] - target[2])
      } else {
        faceYaw = toward(camera.position.x, camera.position.z)
      }
    }
    const moved = Math.hypot(g.position.x - prevX, g.position.z - prevZ)
    const walking = moved > 1e-4
    w.yaw += wrapAngle(faceYaw - w.yaw) * (1 - Math.exp(-POSE_RATE * delta))

    // --- Pose targets (eased) and additive oscillations (applied as is, so they follow the clock exactly)
    w.dist += moved
    const swing = walking ? Math.sin(w.dist * WALK_CYCLE) * 0.7 : 0
    const bob = walking ? Math.abs(Math.sin(w.dist * WALK_CYCLE)) * 0.05 : 0
    const headToPlayer = () => clamp(wrapAngle(toward(camera.position.x, camera.position.z) - w.yaw), -HEAD_MAX_YAW, HEAD_MAX_YAW)
    const T = { sit: 0, lean: 0, armL: 0, armR: 0, headYaw: 0, headPitch: 0, knife: KNIFE_ALONG }
    const A = { armL: 0, headPitch: 0, sway: 0 }
    let rate = POSE_RATE
    let holdsKnife = true
    if (ikeaPhase === 'intro') {
      const reaching = inPhase < PICKUP_AT
      holdsKnife = !reaching
      T.armR = reaching ? -1.4 : -0.9
      T.knife = KNIFE_ACROSS
    } else if (ikeaPhase === 'ordering' || (ikeaPhase === 'lost' && !attacking)) {
      // Stalking: leaning in, heavy sway, knife pointed at the player, eyes on the player.
      T.lean = 0.18
      T.armR = -1.15
      T.armL = -swing
      T.headYaw = headToPlayer()
      A.sway = walking ? Math.sin(w.dist * WALK_CYCLE) * 0.05 : 0
    } else if (attacking) {
      T.lean = 0.2
      T.headYaw = headToPlayer()
      const stabT = inPhase - ATTACK_S * RUN_UNTIL
      if (stabT < 0) {
        // Rising, then running with the knife held high.
        T.armR = inPhase < RISE_S ? ARM_TABLE : -1.7
        T.knife = KNIFE_ACROSS
        T.armL = -swing * 1.4
      } else {
        // The stab: a short wind-up over the head, then down.
        T.armR = stabT < STAB_WINDUP_S ? -2.8 : -0.4
        T.knife = KNIFE_ACROSS
        T.armL = 0.4
        rate = 30
      }
    } else if (!w.atSeat) {
      // On the way to the seat: the knife hangs lowered, he keeps watching the player.
      T.armR = -0.15
      T.armL = -swing
      T.headYaw = headToPlayer()
    } else {
      T.sit = 1
      T.armR = ARM_TABLE // the knife lies flat on the table under his right hand
      T.armL = ARM_TABLE
      if (ikeaPhase === 'drink' && !drinkAsked) {
        // Eating: left hand between the tray and the mouth, head down over the food, chewing.
        const bite = 0.5 + 0.5 * Math.sin(t * 4)
        A.armL = (ARM_MOUTH - ARM_TABLE) * bite
        T.headPitch = 0.18
        A.headPitch = Math.sin(t * 8) * 0.05
      } else if (ikeaPhase === 'won') {
        // Drinking, content: slow sips, head back, a happy sway.
        const sip = 0.5 + 0.5 * Math.sin(t * 2)
        A.armL = (ARM_MOUTH - ARM_TABLE) * sip
        T.headPitch = -0.1
        A.headPitch = -0.25 * sip
        A.sway = Math.sin(t * 3) * 0.05
        T.headYaw = headToPlayer() * 0.5
      } else {
        // Waiting (serve seated, drink once he has asked, deliverDrink): drums the fingers of his left hand, eyes on the
        // player; looks up once he has asked for the drink.
        A.armL = Math.max(0, Math.sin(t * 14)) * 0.12
        T.headYaw = headToPlayer()
        T.headPitch = drinkAsked ? -0.22 : 0
      }
    }

    if (!w.pose) w.pose = { ...T }
    const P = w.pose
    const k = 1 - Math.exp(-rate * delta)
    for (const key in T) P[key] += (T[key] - P[key]) * k

    body.current.position.y = -SIT_DROP * P.sit + bob
    body.current.rotation.set(P.lean, w.yaw, A.sway) // order YXZ: yaw first, then the lean and the sway in his own frame
    legL.current.rotation.x = swing * (1 - P.sit) - 1.5 * P.sit
    legR.current.rotation.x = -swing * (1 - P.sit) - 1.5 * P.sit
    armL.current.rotation.x = P.armL + A.armL
    armR.current.rotation.x = P.armR
    head.current.rotation.set(P.headPitch + A.headPitch, P.headYaw, 0)
    handKnife.current.rotation.x = P.knife
    handKnife.current.visible = holdsKnife
    shelfKnife.current.visible = !holdsKnife

    if (w.atSeat && P.sit > 0.8 && ikeaPhase === 'serve' && !w.seatedReported) {
      w.seatedReported = true
      onSeated?.()
    }

    // Footsteps (positional: louder the further he has come, panned by his side of the camera); heavy and fast in the attack
    if (walking && (ikeaPhase === 'ordering' || attacking)) {
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
          playFootstepSound(attacking ? 0.5 : 0.04 + 0.5 * progress, right / dist)
        } catch {
          // audio unavailable (e.g. no user gesture yet): footsteps are optional
        }
      }
    }
  })

  return (
    <group ref={root} name="rasmus" position={[initial[0], 0, initial[2]]}>
      <group ref={body} rotation={[0, 0, 0, 'YXZ']}>
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
          <group ref={handKnife} position={[0, -0.6, 0.08]} rotation={[KNIFE_ALONG, 0, 0]}>
            <Knife />
          </group>
        </group>

        {/* Head with a side-swept fringe over the forehead; turns toward the player independently of the body */}
        <group ref={head} position={[0, 1.6, 0]} rotation={[0, 0, 0, 'YXZ']}>
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

      {/* The knife on the shelf row until he picks it up (he stands at KNIFE_SHELF_POS in the intro; the row is 0.6 behind him) */}
      <group ref={shelfKnife} position={[0.25, 1.3, -0.6]} visible={false}>
        <Knife />
      </group>

      {/* Red glow as on the other characters (no shadows, constant: the frozen-frame checks compare light state) */}
      <pointLight position={[0, 1.2, 0]} intensity={0.5} distance={3} color="#ff0000" />
    </group>
  )
}

export default Rasmus
