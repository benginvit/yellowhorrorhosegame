import { DRINK_STATION_POS, DRINK_STATION_FACING } from '../levels/ikeaLayout'

/**
 * Drink station (3D placeholder: a box with a lit screen). Stage 2 replaces the content, not the contract.
 *
 * Contract:
 *  - stands at DRINK_STATION_POS (floor level) and its screen faces DRINK_STATION_FACING (a horizontal unit vector);
 *  - the player uses it with F / "Use" when within INTERACT_RANGE; App then opens <DrinkMenu> (ikeaInteractTarget 'drinkStation');
 *  - `active` is true while the drink is asked for (ikeaPhase 'drink'): light the screen up.
 *
 * @param {object} props
 * @param {boolean} [props.active]
 */
function DrinkStation({ active = false }) {
  const yaw = Math.atan2(DRINK_STATION_FACING[0], DRINK_STATION_FACING[2])
  return (
    <group name="drink-station" position={DRINK_STATION_POS} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.9, 1, 0.5]} />
        <meshStandardMaterial color="#0b3d91" />
      </mesh>
      <mesh position={[0, 1.3, 0.05]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.8, 0.6, 0.1]} />
        <meshStandardMaterial color={active ? '#ffda1a' : '#444444'} emissive={active ? '#ffda1a' : '#000000'} emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

export default DrinkStation
