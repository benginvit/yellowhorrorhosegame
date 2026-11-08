import { useLayoutEffect, useRef } from 'react'
import { Matrix4 } from 'three'
import { TRAY_POS, RASMUS_TABLE_POS } from '../levels/ikeaLayout'

export const TABLE_TOP_Y = 0.78 // top of the restaurant tables in IkeaStore
const SERVED_PHASES = ['drink', 'deliverDrink', 'won'] // the tray stands on Rasmus' table once it has been served
const MEATBALLS = 16

const TRAY = '#5b5e63'
const MEATBALL = '#6e3a1c'
const MASH = '#f3e6b8'
const JAM = '#9b1030'
const GLASS = '#dfeaf2'
const LINGON = '#b3122f'

// 4 x 4 meatballs on the left half of the tray.
const MEATBALL_MATRICES = Array.from({ length: MEATBALLS }, (_, i) => {
  const col = i % 4
  const row = Math.floor(i / 4)
  return new Matrix4().makeTranslation(-0.17 + col * 0.085, 0.06, (row - 1.5) * 0.085)
})

function Meatballs() {
  const ref = useRef()
  useLayoutEffect(() => {
    MEATBALL_MATRICES.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MEATBALLS]}>
      <sphereGeometry args={[0.04, 8, 6]} />
      <meshStandardMaterial color={MEATBALL} roughness={0.8} />
    </instancedMesh>
  )
}

/**
 * The tray with 16 meatballs, mashed potatoes and lingonberry jam (one draw call for the meatballs).
 * Origin: centre of the tray's underside; 0.6 x 0.45 on the floor plane.
 */
export function MeatballTray() {
  return (
    <group>
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.6, 0.02, 0.45]} />
        <meshStandardMaterial color={TRAY} />
      </mesh>
      {/* Plate */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.22, 0.2, 0.02, 16]} />
        <meshStandardMaterial color="#f4f4f0" />
      </mesh>
      <Meatballs />
      {/* Mash: a flattened blob */}
      <mesh position={[0.11, 0.05, 0.02]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color={MASH} roughness={0.9} />
      </mesh>
      {/* Lingonberry jam */}
      <mesh position={[0.12, 0.05, -0.1]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={JAM} roughness={0.5} />
      </mesh>
      {/* Fork */}
      <mesh position={[0.26, 0.03, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.012, 0.006, 0.16]} />
        <meshStandardMaterial color="#c8ccd2" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** A glass of red lingonberry drink. Origin: centre of the bottom; 0.16 tall. */
export function LingonGlass() {
  return (
    <group>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.044, 0.036, 0.13, 12]} />
        <meshStandardMaterial color={LINGON} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.05, 0.04, 0.16, 12, 1, true]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.35} roughness={0.1} />
      </mesh>
    </group>
  )
}

/**
 * Every tray and glass in the IKEA scene, in one place so nothing is drawn twice:
 *  - the tray waiting at TRAY_POS on the counter ('serve', nothing carried; named "tray-pickup");
 *  - the tray on Rasmus' table once it has been served ('drink' onward; "tray-on-table"), where he eats from it;
 *  - the glass on his table once the drink has been delivered ('won'; "glass-on-table").
 * What the player carries is CarriedItem (same models).
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
          <MeatballTray />
        </group>
      )}
      {SERVED_PHASES.includes(ikeaPhase) && (
        <group name="tray-on-table" position={[RASMUS_TABLE_POS[0] - 0.1, TABLE_TOP_Y, RASMUS_TABLE_POS[2]]} rotation={[0, Math.PI / 2, 0]}>
          <MeatballTray />
        </group>
      )}
      {ikeaPhase === 'won' && (
        <group name="glass-on-table" position={[RASMUS_TABLE_POS[0] + 0.05, TABLE_TOP_Y, RASMUS_TABLE_POS[2] + 0.4]}>
          <LingonGlass />
        </group>
      )}
    </>
  )
}

export default IkeaServing
