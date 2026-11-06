import { KIOSK_POS, KIOSK_SIZE, KIOSK_FACING } from '../levels/ikeaLayout'

/**
 * The IKEA restaurant/store environment (floor, walls, shelves, tables, the knife shelf at KNIFE_SHELF_POS).
 * Static, no props. Coordinates follow src/levels/ikeaLayout.js.
 * Owns the 3D kiosk (KIOSK_POS / KIOSK_SIZE / KIOSK_FACING); the clickable overlay is OrderKiosk.jsx.
 * STUB: a floor and a blue box for the kiosk. Stage 2 replaces the content, not the contract.
 */
function IkeaStore() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#b8b4a8" />
      </mesh>
      <mesh
        position={[KIOSK_POS[0], KIOSK_POS[1] + KIOSK_SIZE[1] / 2, KIOSK_POS[2]]}
        rotation={[0, Math.atan2(KIOSK_FACING[0], KIOSK_FACING[2]), 0]}
        castShadow
      >
        <boxGeometry args={KIOSK_SIZE} />
        <meshStandardMaterial color="#0058a3" />
      </mesh>
    </>
  )
}

export default IkeaStore
