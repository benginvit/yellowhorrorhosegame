/**
 * IKEA restaurant scene (level 4, Rasmus). STUB: floor and a few crates only.
 * Stage 2 replaces the body with the real 3D scene and the vending machine
 * and keeps this contract.
 *
 * Rendered inside Game's <Canvas> (isIkeaLevel branch); no own Canvas, Player or camera.
 *
 * Props:
 *   ikeaPhase       null | 'intro' | 'ordering' | 'won' | 'lost' (state machine in App.jsx)
 *   ikeaTimeLeft    seconds left of the 40 s ordering phase (steps of 0.1)
 *   ikeaLookingBack true while Rasmus looks back at the player
 *
 * Room bounds match Player's `inClassroom` clamp: x -8.5..8.5, z -7.5..5.8.
 * Player start pose and camera are owned by Game (IKEA_START / IKEA_START_YAW).
 */
function IkeaRestaurant({ ikeaPhase, ikeaTimeLeft, ikeaLookingBack }) { // eslint-disable-line no-unused-vars
  return (
    <group name="ikea-restaurant">
      <mesh position={[0, 0, -1]} receiveShadow>
        <boxGeometry args={[18, 0.1, 15]} />
        <meshStandardMaterial color="#c9b98a" />
      </mesh>
      <mesh position={[0, 4, -1]}>
        <boxGeometry args={[18, 0.1, 15]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {[[-4, -3], [3, -4], [5, 1]].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0.5, z]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#0058a3" />
        </mesh>
      ))}
    </group>
  )
}

export default IkeaRestaurant
