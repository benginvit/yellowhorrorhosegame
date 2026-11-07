import { useLayoutEffect, useRef } from 'react'
import { Color, Matrix4 } from 'three'
import { DRINK_STATION_POS, DRINK_STATION_FACING, DRINKS } from '../levels/ikeaLayout'

const BLUE = '#0058a3'
const YELLOW = '#ffda1a'
const CABINET = '#f1f1ec'
const STEEL = '#aab0b8'
const DARK = '#2b2f36'

// One colour per drink in menu order (water, sparkling, lemonade, elderflower, lingon, raspberry, cola, cola light).
const DRINK_COLOURS = ['#bfe3ff', '#e6f4ff', '#f7e86a', '#eef2c8', '#b3122f', '#e0457b', '#3a1f14', '#8c8c8c']
const TAPS = 4
const CUPS = 6

function Instances({ count, matrices, colours, children }) {
  const ref = useRef()
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
    if (colours) {
      colours.forEach((c, i) => ref.current.setColorAt(i, new Color(c)))
      ref.current.instanceColor.needsUpdate = true
    }
    ref.current.computeBoundingSphere()
  }, [matrices, colours])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      {children}
    </instancedMesh>
  )
}

const BUTTON_MATRICES = DRINKS.map((_, i) => new Matrix4().makeTranslation(-0.27 + (i % 4) * 0.18, 0.1 - Math.floor(i / 4) * 0.2, 0))
const TAP_MATRICES = Array.from({ length: TAPS }, (_, i) => new Matrix4().makeTranslation(-0.3 + i * 0.2, 0, 0))
const CUP_MATRICES = Array.from({ length: CUPS }, (_, i) => new Matrix4().makeTranslation(0, i * 0.03, 0))

/**
 * The drink station: an IKEA-style self-service soda machine with a lit menu screen, four taps over a drip tray and a
 * stack of cups.
 *
 * Contract:
 *  - stands at DRINK_STATION_POS (floor level) and its screen faces DRINK_STATION_FACING (a horizontal unit vector);
 *  - the player uses it with F / "Use" when within INTERACT_RANGE; App then opens <DrinkMenu> (ikeaInteractTarget 'drinkStation');
 *  - `active` is true during ikeaPhase 'drink': the screen lights up;
 *  - `drinkAsked` is true once Rasmus has said "Lingondryck" (ikeaDrinkAsked): the yellow "ready" strip under the screen
 *    lights up as well. Gating the interaction on it is BENG-99 (validInteractTarget).
 * Nothing animates per frame, so a frozen frame is fixed. The cabinet is the only shadow caster (a mesh, not a light).
 *
 * @param {object} props
 * @param {boolean} [props.active]
 * @param {boolean} [props.drinkAsked]
 */
function DrinkStation({ active = false, drinkAsked = false }) {
  const yaw = Math.atan2(DRINK_STATION_FACING[0], DRINK_STATION_FACING[2])
  const ready = active && drinkAsked
  return (
    <group name="drink-station" position={DRINK_STATION_POS} rotation={[0, yaw, 0]}>
      {/* Cabinet with a dark kick plate and a blue top band */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[1.2, 1.7, 0.6]} />
        <meshStandardMaterial color={CABINET} />
      </mesh>
      <mesh position={[0, 0.06, 0.005]}>
        <boxGeometry args={[1.2, 0.12, 0.61]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <boxGeometry args={[1.22, 0.16, 0.62]} />
        <meshStandardMaterial color={BLUE} />
      </mesh>
      <mesh position={[0, 1.78, 0.311]}>
        <planeGeometry args={[1.2, 0.05]} />
        <meshStandardMaterial color={YELLOW} />
      </mesh>

      {/* Menu screen (tilted toward the player) with the eight drink buttons */}
      <group position={[0, 1.42, 0.3]} rotation={[-0.15, 0, 0]}>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.9, 0.56, 0.06]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <mesh position={[0, 0, 0.051]}>
          <planeGeometry args={[0.82, 0.48]} />
          <meshStandardMaterial
            color={active ? '#e9f5ff' : '#3b4450'}
            emissive={active ? '#9fd0ff' : '#111418'}
            emissiveIntensity={active ? 1.2 : 0.4}
            toneMapped={false}
          />
        </mesh>
        <group position={[0, 0, 0.06]}>
          <Instances count={DRINKS.length} matrices={BUTTON_MATRICES} colours={DRINK_COLOURS}>
            <boxGeometry args={[0.14, 0.14, 0.015]} />
            <meshStandardMaterial roughness={0.6} />
          </Instances>
        </group>
      </group>
      {/* "Ready" strip: lights up once Rasmus has asked for his drink */}
      <mesh position={[0, 1.08, 0.302]}>
        <planeGeometry args={[0.9, 0.05]} />
        <meshStandardMaterial color={ready ? YELLOW : '#6b6b66'} emissive={ready ? YELLOW : '#000000'} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>

      {/* Taps over the drip tray */}
      <group position={[0, 0.98, 0.36]}>
        <Instances count={TAPS} matrices={TAP_MATRICES}>
          <cylinderGeometry args={[0.025, 0.02, 0.16, 8]} />
          <meshStandardMaterial color={STEEL} metalness={0.6} roughness={0.35} />
        </Instances>
      </group>
      <mesh position={[0, 0.98, 0.33]}>
        <boxGeometry args={[0.85, 0.06, 0.14]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.62, 0.38]}>
        <boxGeometry args={[0.9, 0.04, 0.22]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <mesh position={[0, 0.645, 0.38]}>
        <boxGeometry args={[0.8, 0.01, 0.16]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Cup stack on a side shelf */}
      <mesh position={[0.78, 1.0, 0.1]}>
        <boxGeometry args={[0.36, 0.03, 0.4]} />
        <meshStandardMaterial color={BLUE} />
      </mesh>
      <mesh position={[0.78, 0.5, 0.1]}>
        <boxGeometry args={[0.04, 1.0, 0.04]} />
        <meshStandardMaterial color={STEEL} />
      </mesh>
      <group position={[0.78, 1.09, 0.1]}>
        <Instances count={CUPS} matrices={CUP_MATRICES}>
          <cylinderGeometry args={[0.055, 0.04, 0.15, 10, 1, true]} />
          <meshStandardMaterial color="#f7f7f2" side={2} />
        </Instances>
      </group>
    </group>
  )
}

export default DrinkStation
