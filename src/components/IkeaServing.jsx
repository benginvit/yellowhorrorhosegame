import { TRAY_POS, RASMUS_TABLE_POS } from '../levels/ikeaLayout'

const TABLE_TOP_Y = 0.78 // top of the restaurant tables in IkeaStore

/**
 * The tray waiting at TRAY_POS (placeholder) and, once the drink is delivered, the glass on Rasmus' table.
 * Rasmus.jsx draws the tray that stands on his table after serving.
 *
 * @param {object} props
 * @param {string|null} props.ikeaPhase
 * @param {null|'tray'|'drink'} props.carrying
 */
function IkeaServing({ ikeaPhase, carrying }) {
  return (
    <>
      {ikeaPhase === 'serve' && carrying === null && (
        <group name="tray-pickup" position={TRAY_POS}>
          <mesh>
            <boxGeometry args={[0.6, 0.04, 0.45]} />
            <meshStandardMaterial color="#e8e8e8" />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial color="#7a3b1d" />
          </mesh>
        </group>
      )}
      {ikeaPhase === 'won' && (
        <mesh name="glass-on-table" position={[RASMUS_TABLE_POS[0] + 0.2, TABLE_TOP_Y + 0.08, RASMUS_TABLE_POS[2] + 0.45]}>
          <cylinderGeometry args={[0.05, 0.04, 0.16, 12]} />
          <meshStandardMaterial color="#b3122f" transparent opacity={0.85} />
        </mesh>
      )}
    </>
  )
}

export default IkeaServing
