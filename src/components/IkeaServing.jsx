import { TRAY_POS, RASMUS_TABLE_POS } from '../levels/ikeaLayout'

const TABLE_TOP_Y = 0.78 // top of the restaurant tables in IkeaStore
const MEATBALLS = 16

const meatballPositions = Array.from({ length: MEATBALLS }, (_, i) => {
  const col = i % 4
  const row = Math.floor(i / 4)
  return [(col - 1.5) * 0.09 - 0.1, 0.07, (row - 1.5) * 0.09 - 0.03]
})

/**
 * The tray with 16 meatballs and a heap of mash, origin at the tray's underside. The single drawing of the tray: it is used at
 * TRAY_POS, in the player's hands (CarriedItem) and on Rasmus' table. No shadow casters.
 */
export function Tray() {
  return (
    <group>
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.6, 0.02, 0.5]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
      <mesh position={[0.2, 0.06, 0]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial color="#f1e3b0" />
      </mesh>
      {meatballPositions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color="#7a3b1d" />
        </mesh>
      ))}
    </group>
  )
}

/** A glass of red lingonberry drink, origin at the foot of the glass. */
export function Glass() {
  return (
    <group>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.05, 0.04, 0.16, 12]} />
        <meshStandardMaterial color="#d8e8f0" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.044, 0.037, 0.12, 12]} />
        <meshStandardMaterial color="#b3122f" emissive="#4a0510" />
      </mesh>
    </group>
  )
}

/**
 * Everything served, drawn here and nowhere else: the tray waiting at TRAY_POS, the tray on Rasmus' table once it has been
 * served (from 'drink' on), and the glass on the table at 'won'. Rasmus.jsx and CarriedItem.jsx draw no tray of their own.
 *
 * @param {object} props
 * @param {string|null} props.ikeaPhase
 * @param {null|'tray'|'drink'} props.carrying
 */
function IkeaServing({ ikeaPhase, carrying }) {
  const served = ikeaPhase === 'drink' || ikeaPhase === 'deliverDrink' || ikeaPhase === 'won'
  return (
    <>
      {ikeaPhase === 'serve' && carrying === null && (
        <group name="tray-pickup" position={TRAY_POS}>
          <Tray />
        </group>
      )}
      {served && (
        <group name="tray-on-table" position={[RASMUS_TABLE_POS[0] - 0.15, TABLE_TOP_Y, RASMUS_TABLE_POS[2]]}>
          <Tray />
        </group>
      )}
      {ikeaPhase === 'won' && (
        <group name="glass-on-table" position={[RASMUS_TABLE_POS[0] + 0.2, TABLE_TOP_Y, RASMUS_TABLE_POS[2] + 0.45]}>
          <Glass />
        </group>
      )}
    </>
  )
}

export default IkeaServing
