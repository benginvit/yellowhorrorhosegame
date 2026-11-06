/**
 * The IKEA restaurant/store environment (floor, walls, shelves, tables, the knife shelf at KNIFE_SHELF_POS).
 * Static, no props. Coordinates follow src/levels/ikeaLayout.js.
 * STUB: only a floor. Stage 2 replaces the content, not the contract.
 */
function IkeaStore() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#b8b4a8" />
    </mesh>
  )
}

export default IkeaStore
