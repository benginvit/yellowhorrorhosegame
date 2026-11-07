import { DRINK_STATION_POS, DRINK_STATION_FACING } from '../levels/ikeaLayout'

const BLUE = '#0b3d91'
const YELLOW = '#ffda1a'
const STEEL = '#b8bec6'
const TAPS = [
  { x: -0.28, color: '#b3122f' }, // lingonberry
  { x: 0, color: '#f2c14e' },
  { x: 0.28, color: '#3a7bd5' },
]
const CUPS = [0, 1, 2, 3, 4]

/**
 * Drink station in IKEA style: a blue cabinet with a lit screen, three taps over a drip tray and a stack of cups. No shadow casters.
 *
 * Contract:
 *  - stands at DRINK_STATION_POS (floor level) and its screen faces DRINK_STATION_FACING (a horizontal unit vector);
 *  - the player uses it with F / "Use" when within INTERACT_RANGE; App then opens <DrinkMenu> (ikeaInteractTarget 'drinkStation');
 *  - `active` is true during ikeaPhase 'drink': the screen is lit (dim until Rasmus has asked);
 *  - `drinkAsked` is true once Rasmus has said "Lingondryck" (ikeaDrinkAsked): the screen lights up fully and the lingonberry
 *    tap glows. Gating the station on it is BENG-99.
 *
 * @param {object} props
 * @param {boolean} [props.active]
 * @param {boolean} [props.drinkAsked]
 */
function DrinkStation({ active = false, drinkAsked = false }) {
  const yaw = Math.atan2(DRINK_STATION_FACING[0], DRINK_STATION_FACING[2])
  const lit = active && drinkAsked
  const screenColor = active ? YELLOW : '#444444'
  return (
    <group name="drink-station" position={DRINK_STATION_POS} rotation={[0, yaw, 0]}>
      {/* Cabinet */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.9, 1, 0.5]} />
        <meshStandardMaterial color={BLUE} />
      </mesh>
      {/* Yellow stripe along the top of the cabinet */}
      <mesh position={[0, 1.02, 0.01]}>
        <boxGeometry args={[0.92, 0.04, 0.52]} />
        <meshStandardMaterial color={YELLOW} />
      </mesh>
      {/* Back panel carrying the screen */}
      <mesh position={[0, 1.55, -0.18]}>
        <boxGeometry args={[0.9, 1, 0.14]} />
        <meshStandardMaterial color={BLUE} />
      </mesh>
      {/* Lit screen */}
      <mesh position={[0, 1.55, -0.1]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.72, 0.55, 0.04]} />
        <meshStandardMaterial color={screenColor} emissive={active ? screenColor : '#000000'} emissiveIntensity={lit ? 0.9 : active ? 0.35 : 0} />
      </mesh>
      {/* Taps over the drip tray, on the front of the cabinet top */}
      {TAPS.map(({ x, color }, i) => (
        <group key={x} position={[x, 1.1, 0.12]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.2, 8]} />
            <meshStandardMaterial color={STEEL} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.2, 0.0]}>
            <boxGeometry args={[0.07, 0.07, 0.07]} />
            <meshStandardMaterial color={color} emissive={i === 0 && lit ? color : '#000000'} emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0, -0.01, 0.07]}>
            <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
            <meshStandardMaterial color={STEEL} metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.05, 0.2]}>
        <boxGeometry args={[0.8, 0.02, 0.16]} />
        <meshStandardMaterial color="#222a33" />
      </mesh>
      {/* Stack of cups beside the station */}
      <group position={[0.62, 0, 0]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.3, 0.9, 0.3]} />
          <meshStandardMaterial color={BLUE} />
        </mesh>
        {CUPS.map((i) => (
          <mesh key={i} position={[0, 0.95 + i * 0.045, 0]}>
            <cylinderGeometry args={[0.07 - i * 0.002, 0.045, 0.1, 12]} />
            <meshStandardMaterial color="#f4f4f4" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default DrinkStation
